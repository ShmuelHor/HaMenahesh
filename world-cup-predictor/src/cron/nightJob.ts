import cron from 'node-cron';
import { Prediction } from '../models/prediction.model';
import { runPostMatchCheck } from './postMatchJob';
import { sendSystemError, sendNightSummary } from '../services/telegram.service';
import { logger } from '../utils/logger';
import { startOfDay, endOfDay } from '../utils/stats';

async function runNightJob(): Promise<void> {
  logger.info('Night job started');

  // Final sweep to pick up any results missed by the 30-min poller
  await runPostMatchCheck();

  const now = new Date();
  const todayPredictions = await Prediction.find({
    matchDate: { $gte: startOfDay(now), $lte: endOfDay(now) },
  }).lean();

  if (!todayPredictions.length) {
    logger.info('No predictions for today, skipping night summary');
    return;
  }

  const finished = todayPredictions.filter((p) => p.resultFetched);
  const correct = finished.filter((p) => p.isCorrectWinner).length;
  const exact = finished.filter((p) => p.isExactScore).length;

  if (finished.length > 0) {
    await sendNightSummary(todayPredictions.length, finished.length, correct, exact);
  }

  logger.info('Night job completed', {
    total: todayPredictions.length,
    finished: finished.length,
    correct,
    exact,
  });
}

export function registerNightJob(): void {
  cron.schedule(
    '0 23 * * *',
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

  logger.info('Night job registered (23:00 Israel time)');
}
