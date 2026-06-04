import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';
import { IPrediction, WeeklyStats } from '../types';
import { formatDateIsrael } from '../utils/prompt.builder';
import { he } from '../i18n/he';

const tgAxios = axios.create({
  baseURL: `https://api.telegram.org/bot${config.telegramBotToken}`,
  timeout: 10000,
});

async function sendMessage(text: string, parseMode: 'HTML' | 'Markdown' = 'HTML'): Promise<void> {
  await withRetry(
    () =>
      tgAxios.post('/sendMessage', {
        chat_id: config.telegramChatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    { maxAttempts: 3, baseDelayMs: 2000 },
    'telegram-send'
  );
}

export async function sendPrediction(prediction: IPrediction): Promise<void> {
  const dateStr = formatDateIsrael(prediction.matchDate);

  const lines = [
    he.prediction.header,
    '',
    he.prediction.match(
      prediction.homeFlag, prediction.homeTeam,
      prediction.predictedHome, prediction.predictedAway,
      prediction.awayTeam, prediction.awayFlag
    ),
    '',
    he.prediction.date(dateStr),
    he.prediction.venue(prediction.venue),
    he.prediction.ranks(prediction.homeRank, prediction.awayRank),
    he.prediction.confidence(prediction.confidence),
    '',
    he.prediction.reasoning(prediction.reasoning),
  ];

  await sendMessage(lines.join('\n'));
  logger.info('Prediction sent to Telegram', { matchId: prediction.matchId });
}

export async function sendDailySummary(
  predictions: IPrediction[],
  totalCorrect: number,
  totalPredictions: number
): Promise<void> {
  if (!predictions.length) return;

  const dateLabel = formatDateIsrael(predictions[0].matchDate).split(',')[0].replace('יום ', '');
  const lines: string[] = [he.dailySummary.header(dateLabel), ''];

  for (const p of predictions) {
    lines.push(
      he.dailySummary.matchLine(p.homeFlag, p.homeTeam, p.predictedHome, p.predictedAway, p.awayTeam, p.awayFlag),
      he.dailySummary.confidenceLine(p.confidence, p.homeRank, p.awayRank),
      p.reasoning,
      ''
    );
  }

  if (totalPredictions > 0) {
    lines.push(he.dailySummary.accuracy(totalCorrect, totalPredictions));
  }

  await sendMessage(lines.join('\n'));
  logger.info('Daily summary sent to Telegram', { count: predictions.length });
}

export async function sendPreMatchReminder(prediction: IPrediction): Promise<void> {
  const lines = [
    he.preMatch.header,
    '',
    he.preMatch.match(prediction.homeFlag, prediction.homeTeam, prediction.awayTeam, prediction.awayFlag),
    '',
    he.preMatch.prediction(prediction.predictedHome, prediction.predictedAway),
    he.preMatch.confidence(prediction.confidence),
    '',
    he.preMatch.reasoning(prediction.reasoning),
  ];

  await sendMessage(lines.join('\n'));
  logger.info('Pre-match reminder sent', { matchId: prediction.matchId });
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

export async function sendNoMatchesToday(): Promise<void> {
  const today = new Date();
  const dateStr = `${today.getUTCDate()}/${today.getUTCMonth() + 1}/${today.getUTCFullYear()}`;
  await sendMessage(he.system.noMatchesToday(dateStr));
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
