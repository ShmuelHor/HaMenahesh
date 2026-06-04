import cron from 'node-cron';
import { Prediction } from '../models/prediction.model';
import { sendWeeklyReport, sendSystemError } from '../services/telegram.service';
import { computeWeeklyStats, daysAgo } from '../utils/stats';
import { logger } from '../utils/logger';
import { IPrediction } from '../types';

async function runWeeklyReport(): Promise<void> {
  logger.info('Weekly report job started');

  const weekStart = daysAgo(7);
  const weekEnd = new Date();

  const predictions = await Prediction.find({
    matchDate: { $gte: weekStart, $lte: weekEnd },
  })
    .sort({ matchDate: 1 })
    .lean();

  if (!predictions.length) {
    logger.info('No predictions in the last 7 days, skipping report');
    return;
  }

  const stats = computeWeeklyStats(
    predictions as unknown as IPrediction[],
    weekStart,
    weekEnd
  );

  await sendWeeklyReport(stats);

  logger.info('Weekly report sent', {
    total: stats.totalPredictions,
    correctWinners: stats.correctWinners,
    exactScores: stats.exactScores,
  });
}

export function registerWeeklyReport(): void {
  cron.schedule(
    '0 20 * * 0',
    async () => {
      try {
        await runWeeklyReport();
      } catch (err) {
        logger.error('Weekly report job failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        await sendSystemError('weekly report', err);
      }
    },
    { timezone: 'Asia/Jerusalem' }
  );

  logger.info('Weekly report job registered (Sunday 20:00 Israel time)');
}
