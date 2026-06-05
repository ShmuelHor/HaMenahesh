import http from 'http';
import './config'; // Validates env vars at startup — throws immediately if any are missing
import { connectMongo, disconnectMongo, isConnected } from './db/mongo';
import { registerMorningJob, runMorningJob } from './cron/morningJob';
import { registerPostMatchJob } from './cron/postMatchJob';
import { registerNightJob } from './cron/nightJob';
import { registerWeeklyReport } from './cron/weeklyReport';
import { registerDailyHealthJob } from './cron/dailyHealthJob';
import { rescheduleUnnotifiedReminders, clearAllTimeouts } from './cron/preMatchJob';
import { checkAllServices } from './services/health.service';
import { sendStartupMessage } from './services/telegram.service';
import { logger } from './utils/logger';

// Minimal HTTP server used only by the Docker HEALTHCHECK
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    if (isConnected()) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
    } else {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end('MongoDB not connected');
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully`);
  healthServer.close();
  clearAllTimeouts();
  await disconnectMongo();
  logger.info('Shutdown complete');
  process.exit(0);
}

async function main(): Promise<void> {
  logger.info('World Cup 2026 Predictor starting');

  await connectMongo();

  // Recover any pre-match reminders that were pending when the container last stopped
  await rescheduleUnnotifiedReminders();

  registerMorningJob();
  registerPostMatchJob();
  registerNightJob();
  registerWeeklyReport();
  registerDailyHealthJob();

  healthServer.listen(3000, () => {
    logger.info('Health endpoint listening on port 3000');
  });

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  logger.info('All cron jobs registered — system ready');

  // Check all external services and send a startup message to Telegram.
  // A failure here should never crash the app — the system can still run without it.
  try {
    const statuses = await checkAllServices();
    await sendStartupMessage(statuses);
    logger.info('Startup message sent to Telegram');
  } catch (err) {
    logger.error('Failed to send startup message to Telegram', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Run the morning job immediately on startup when set (useful for testing)
  if (process.env.RUN_MORNING_NOW === 'true') {
    logger.info('RUN_MORNING_NOW=true — running morning job immediately');
    await runMorningJob();
  }
}

main().catch((err) => {
  logger.error('Fatal startup error', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});
