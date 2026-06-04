import cron from 'node-cron';
import { IPrediction } from '../types';
import { Prediction } from '../models/prediction.model';
import { getMatchById } from '../services/football.service';
import { sendPostMatchResult, sendSystemError } from '../services/telegram.service';
import { logger } from '../utils/logger';
import { startOfDay, endOfDay } from '../utils/stats';

function numericMatchId(matchId: string): number {
  return parseInt(matchId.replace('fd-', ''), 10);
}

function computeWinner(home: number, away: number): 'HOME' | 'AWAY' | 'DRAW' {
  if (home > away) return 'HOME';
  if (away > home) return 'AWAY';
  return 'DRAW';
}

export async function runPostMatchCheck(): Promise<void> {
  const now = new Date();
  const pending = await Prediction.find({
    matchDate: { $gte: startOfDay(now), $lte: endOfDay(now) },
    resultFetched: false,
  }).lean();

  if (!pending.length) {
    logger.debug('No pending matches to check for results');
    return;
  }

  logger.info(`Checking results for ${pending.length} matches`);

  for (const pred of pending) {
    try {
      const id = numericMatchId(pred.matchId as string);
      const match = await getMatchById(id);

      if (match.status !== 'FINISHED') {
        logger.debug('Match not finished yet', { matchId: pred.matchId, status: match.status });
        continue;
      }

      const actualHome = match.score.fullTime.home!;
      const actualAway = match.score.fullTime.away!;

      const predictedWinner = computeWinner(pred.predictedHome as number, pred.predictedAway as number);
      const actualWinner = computeWinner(actualHome, actualAway);
      const isCorrectWinner = predictedWinner === actualWinner;
      const isExactScore =
        pred.predictedHome === actualHome && pred.predictedAway === actualAway;

      await Prediction.updateOne(
        { matchId: pred.matchId },
        {
          $set: {
            actualHome,
            actualAway,
            resultFetched: true,
            isCorrectWinner,
            isExactScore,
            postMatchNotified: true,
          },
        }
      );

      const updated = await Prediction.findOne({ matchId: pred.matchId }).lean();
      if (updated) {
        await sendPostMatchResult(updated as unknown as IPrediction);
      }

      logger.info('Match result saved', {
        matchId: pred.matchId,
        actualHome,
        actualAway,
        isCorrectWinner,
        isExactScore,
      });
    } catch (err) {
      logger.error('Failed to check match result', {
        matchId: pred.matchId,
        error: err instanceof Error ? err.message : String(err),
      });
      await sendSystemError(`post-match check ${pred.matchId as string}`, err);
    }
  }
}

export function registerPostMatchJob(): void {
  cron.schedule('*/30 * * * *', async () => {
    logger.debug('Post-match result check running');
    try {
      await runPostMatchCheck();
    } catch (err) {
      logger.error('Post-match job failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  logger.info('Post-match job registered (every 30 minutes)');
}
