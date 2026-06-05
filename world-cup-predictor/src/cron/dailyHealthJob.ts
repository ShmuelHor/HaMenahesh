import cron from 'node-cron';
import { config } from '../config';
import { checkAllServices } from '../services/health.service';
import { sendDailyHealthMessage } from '../services/telegram.service';
import { logger } from '../utils/logger';

async function runDailyHealthCheck(): Promise<void> {
  logger.info('Daily health check started');
  const statuses = await checkAllServices();
  await sendDailyHealthMessage(statuses);
  logger.info('Daily health check sent to admin chat');
}

export function registerDailyHealthJob(): void {
  cron.schedule(
    config.cronDailyHealth,
    async () => {
      try {
        await runDailyHealthCheck();
      } catch (err) {
        logger.error('Daily health check failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    { timezone: 'Asia/Jerusalem' }
  );

  logger.info(`Daily health check registered (${config.cronDailyHealth})`);
}
