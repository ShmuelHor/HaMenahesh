import cron from 'node-cron';
import { config } from '../config';
import { runPostMatchCheck } from './postMatchJob';
import { sendSystemError } from '../services/telegram.service';
import { logger } from '../utils/logger';

async function runNightJob(): Promise<void> {
  logger.info('Night job started');

  // Final sweep to pick up any results missed by the 30-min poller
  await runPostMatchCheck();

  logger.info('Night job completed');
}

export function registerNightJob(): void {
  cron.schedule(
    config.cronNight,
    async () => {
      try {
        await runNightJob();
      } catch (err) {
        logger.error('Night job failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        await sendSystemError('night job', err);
      }
    },
    { timezone: 'Asia/Jerusalem' }
  );

  logger.info(`Night job registered (${config.cronNight})`);
}
