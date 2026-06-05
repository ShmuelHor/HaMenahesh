import { Prediction } from '../models/prediction.model';
import { sendPreMatchReminder, sendSystemError } from '../services/telegram.service';
import { logger } from '../utils/logger';
import { IPrediction } from '../types';
import { config } from '../config';

// Tracks active timeouts so they can be cleared on graceful shutdown
export const activeTimeouts = new Set<NodeJS.Timeout>();

export function schedulePreMatchReminder(prediction: IPrediction): void {
  const matchTime = new Date(prediction.matchDate).getTime();
  const reminderTime = matchTime - config.preMatchReminderMinutes * 60 * 1000;
  const delayMs = reminderTime - Date.now();

  if (delayMs <= 0) {
    logger.debug('Skipping pre-match reminder — too close to kick-off', {
      matchId: prediction.matchId,
      delayMs,
    });
    return;
  }

  const minutesUntil = Math.round(delayMs / 60000);
  logger.info(`Pre-match reminder scheduled in ${minutesUntil} minutes`, {
    matchId: prediction.matchId,
    home: prediction.homeTeam,
    away: prediction.awayTeam,
  });

  const timeout = setTimeout(async () => {
    activeTimeouts.delete(timeout);
    try {
      await sendPreMatchReminder(prediction);
      await Prediction.updateOne(
        { matchId: prediction.matchId },
        { $set: { preMatchNotified: true } }
      );
      logger.info('Pre-match reminder sent', { matchId: prediction.matchId });
    } catch (err) {
      logger.error('Pre-match reminder failed', { matchId: prediction.matchId });
      await sendSystemError(`pre-match reminder ${prediction.matchId}`, err);
    }
  }, delayMs);

  activeTimeouts.add(timeout);
}

export async function rescheduleUnnotifiedReminders(): Promise<void> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  const pending = await Prediction.find({
    matchDate: { $gte: todayStart },
    preMatchNotified: false,
  }).lean();

  if (!pending.length) return;

  logger.info(`Rescheduling ${pending.length} unnotified reminders after restart`);
  for (const pred of pending) {
    schedulePreMatchReminder(pred as unknown as IPrediction);
  }
}

export function clearAllTimeouts(): void {
  for (const timeout of activeTimeouts) {
    clearTimeout(timeout);
  }
  activeTimeouts.clear();
  logger.info('All scheduled timeouts cleared');
}
