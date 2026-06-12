import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';
import { IPrediction, WeeklyStats } from '../types';
import { Prediction } from '../models/prediction.model';
import { formatDateIsrael, formatMatchDateTime } from '../utils/prompt.builder';
import { getVenueInfo } from '../utils/venue-info';
import { he } from '../i18n/he';
import type { ServiceStatus } from './health.service';

const tgAxios = axios.create({
  baseURL: `https://api.telegram.org/bot${config.telegramBotToken}`,
  timeout: 10000,
});

async function sendMessage(
  text: string,
  parseMode: 'HTML' | 'Markdown' = 'HTML',
  chatId = config.telegramChatId
): Promise<void> {
  await withRetry(
    async () => {
      try {
        await tgAxios.post('/sendMessage', {
          chat_id: chatId,
          text,
          parse_mode: parseMode,
          disable_web_page_preview: true,
        });
      } catch (err) {
        // Extract Telegram's error description from the response body
        const tgError =
          axios.isAxiosError(err) && err.response?.data?.description
            ? err.response.data.description
            : err instanceof Error
            ? err.message
            : String(err);
        throw new Error(`Telegram: ${tgError}`);
      }
    },
    { maxAttempts: 3, baseDelayMs: 2000 },
    'telegram-send'
  );
}

export async function sendMatchPrediction(prediction: IPrediction, chatId = config.telegramChatId): Promise<void> {
  const { date, time } = formatMatchDateTime(new Date(prediction.matchDate));
  const venueInfo = getVenueInfo(prediction.venue);

  const lines = [
    he.prediction.header,
    '',
    he.prediction.match(prediction.homeFlag, prediction.homeTeam, prediction.awayTeam, prediction.awayFlag),
    '',
    he.prediction.datetime(date, time),
  ];

  if (prediction.venue) {
    lines.push(he.prediction.stadium(prediction.venue));
  }
  if (venueInfo) {
    lines.push(he.prediction.location(venueInfo.city, venueInfo.country, venueInfo.flag));
  }

  lines.push(
    '',
    he.prediction.score(prediction.homeFlag, prediction.predictedHome, prediction.awayFlag, prediction.predictedAway),
    '',
    he.prediction.ranks(prediction.homeFlag, prediction.homeRank, prediction.awayFlag, prediction.awayRank),
    he.prediction.confidence(prediction.confidence),
    '',
    he.prediction.reasoning(prediction.reasoning),
  );

  await sendMessage(lines.join('\n'), 'HTML', chatId);
  logger.info('Match prediction sent to Telegram', { matchId: prediction.matchId });
}

export async function sendPostMatchResult(prediction: IPrediction): Promise<void> {
  const exact = prediction.isExactScore;
  const correctWinner = prediction.isCorrectWinner;

  const header = exact
    ? he.postMatch.headerExact
    : correctWinner
    ? he.postMatch.headerCorrect
    : he.postMatch.headerWrong;

  const resultLabel = exact
    ? he.postMatch.labelExact
    : correctWinner
    ? he.postMatch.labelCorrect
    : he.postMatch.labelWrong;

  const lines = [
    header,
    '',
    he.postMatch.result(
      prediction.homeFlag, prediction.homeTeam,
      prediction.actualHome!, prediction.actualAway!,
      prediction.awayTeam, prediction.awayFlag
    ),
    '',
    he.postMatch.predicted(prediction.predictedHome, prediction.predictedAway),
    he.postMatch.actual(prediction.actualHome!, prediction.actualAway!),
    resultLabel,
  ];

  await sendMessage(lines.join('\n'));
  logger.info('Post-match result sent', {
    matchId: prediction.matchId,
    exact,
    correctWinner,
  });
}

export async function sendWeeklyReport(stats: WeeklyStats): Promise<void> {
  const weekNum = Math.ceil(
    (stats.weekEnd.getTime() - new Date('2026-06-11').getTime()) /
      (7 * 24 * 60 * 60 * 1000)
  );

  const lines = [
    he.weeklyReport.header(weekNum),
    '',
    he.weeklyReport.total(stats.totalPredictions),
    he.weeklyReport.winners(stats.correctWinners, stats.totalPredictions, stats.winnerAccuracyPct),
    he.weeklyReport.exact(stats.exactScores, stats.totalPredictions, stats.exactScorePct),
    '',
    he.weeklyReport.detailHeader,
  ];

  const finished = stats.predictions.filter((p) => p.resultFetched);
  if (finished.length === 0) {
    lines.push(he.weeklyReport.noFinished);
  } else {
    for (const p of finished) {
      const icon = p.isExactScore ? '⚽' : p.isCorrectWinner ? '✓' : '✗';
      lines.push(
        he.weeklyReport.matchRow(
          icon,
          p.homeFlag, p.homeTeam, p.predictedHome, p.predictedAway,
          p.awayTeam, p.awayFlag,
          p.actualHome!, p.actualAway!
        )
      );
    }
  }

  await sendMessage(lines.join('\n'));
  logger.info('Weekly report sent to Telegram');
}

export async function sendSystemError(context: string, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);

  // Single attempt — never retry error notifications to avoid infinite loops
  try {
    await tgAxios.post('/sendMessage', {
      chat_id: config.telegramChatId,
      text: he.system.error(context, message),
      parse_mode: 'HTML',
    });
  } catch (sendErr) {
    logger.error('Failed to send system error to Telegram', {
      original: message,
      sendError: sendErr instanceof Error ? sendErr.message : String(sendErr),
    });
  }
}

async function sendAdminMessage(text: string): Promise<void> {
  await withRetry(
    async () => {
      try {
        await tgAxios.post('/sendMessage', {
          chat_id: config.telegramAdminChatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        });
      } catch (err) {
        const tgError =
          axios.isAxiosError(err) && err.response?.data?.description
            ? err.response.data.description
            : err instanceof Error
            ? err.message
            : String(err);
        throw new Error(`Telegram: ${tgError}`);
      }
    },
    { maxAttempts: 3, baseDelayMs: 2000 },
    'telegram-admin'
  );
}

function buildServiceLines(statuses: import('./health.service').ServiceStatus[]): string {
  return statuses
    .map((s) => `${s.ok ? '✅' : '❌'} ${s.name}${s.ok ? '' : ` — ${s.error}`}`)
    .join('\n');
}

export async function sendStartupMessage(
  statuses: import('./health.service').ServiceStatus[]
): Promise<void> {
  const allOk = statuses.every((s) => s.ok);
  await sendAdminMessage(he.startup(buildServiceLines(statuses), allOk));
}

export async function sendDailyHealthMessage(
  statuses: import('./health.service').ServiceStatus[]
): Promise<void> {
  const allOk = statuses.every((s) => s.ok);
  const failed = statuses.filter((s) => !s.ok);
  const lines = allOk ? '' : buildServiceLines(failed);
  await sendAdminMessage(he.healthCheck(lines, allOk));
}

export async function sendNoMatchesToday(): Promise<void> {
  const today = new Date();
  const dateStr = `${today.getUTCDate()}/${today.getUTCMonth() + 1}/${today.getUTCFullYear()}`;
  await sendMessage(he.system.noMatchesToday(dateStr));
}

export async function sendYesterdaySummary(
  predictions: IPrediction[],
  overallCorrect: number,
  overallTotal: number,
  overallExact: number,
  chatId = config.telegramChatId
): Promise<void> {
  const finished = predictions.filter((p) => p.resultFetched);
  const correct = finished.filter((p) => p.isCorrectWinner).length;
  const exact = finished.filter((p) => p.isExactScore).length;

  const lines: string[] = [he.yesterdaySummary.header, ''];

  for (const p of predictions) {
    if (p.resultFetched) {
      const icon = p.isExactScore ? '✅' : p.isCorrectWinner ? '✓' : '❌';
      lines.push(he.yesterdaySummary.matchRow(
        icon, p.homeFlag, p.homeTeam, p.predictedHome, p.predictedAway,
        p.awayTeam, p.awayFlag, p.actualHome!, p.actualAway!
      ));
    } else {
      lines.push(he.yesterdaySummary.pending(p.homeFlag, p.homeTeam, p.awayTeam, p.awayFlag));
    }
  }

  lines.push('');

  if (finished.length > 0) {
    lines.push(he.yesterdaySummary.accuracy(correct, finished.length, exact));
  } else {
    lines.push(he.yesterdaySummary.noResults);
  }

  if (overallTotal > 0) {
    lines.push(he.yesterdaySummary.overallAccuracy(overallCorrect, overallTotal, overallExact));
  }

  await sendMessage(lines.join('\n'), 'HTML', chatId);
  logger.info('Last-24h summary sent to Telegram', { total: predictions.length, finished: finished.length });
}

export async function sendStatsTo(chatId: string): Promise<void> {
  const total = await Prediction.countDocuments({ resultFetched: true });
  if (total === 0) {
    await sendMessage(he.stats.noData, 'HTML', chatId);
    return;
  }
  const correct = await Prediction.countDocuments({ resultFetched: true, isCorrectWinner: true });
  const exact = await Prediction.countDocuments({ resultFetched: true, isExactScore: true });
  const lines = [
    he.stats.header,
    '',
    he.stats.total(total),
    he.stats.winners(correct, total, Math.round((correct / total) * 100)),
    he.stats.exact(exact, total, Math.round((exact / total) * 100)),
  ];
  await sendMessage(lines.join('\n'), 'HTML', chatId);
  logger.info('Stats sent to Telegram');
}

export async function sendNightSummary(
  totalToday: number,
  finished: number,
  correct: number,
  exact: number
): Promise<void> {
  const lines = [
    he.nightSummary.header,
    '',
    he.nightSummary.matchesCount(totalToday),
    he.nightSummary.resultsReceived(finished),
    he.nightSummary.correctWinners(correct, finished),
    he.nightSummary.exactScores(exact, finished),
  ];
  await sendMessage(lines.join('\n'));
}
