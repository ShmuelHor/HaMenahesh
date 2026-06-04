import { IPrediction, WeeklyStats } from '../types';

export function computeWeeklyStats(
  predictions: IPrediction[],
  weekStart: Date,
  weekEnd: Date
): WeeklyStats {
  const finished = predictions.filter((p) => p.resultFetched);
  const correctWinners = finished.filter((p) => p.isCorrectWinner).length;
  const exactScores = finished.filter((p) => p.isExactScore).length;
  const total = finished.length;

  return {
    totalPredictions: total,
    correctWinners,
    exactScores,
    winnerAccuracyPct: total > 0 ? Math.round((correctWinners / total) * 100) : 0,
    exactScorePct: total > 0 ? Math.round((exactScores / total) * 100) : 0,
    predictions,
    weekStart,
    weekEnd,
  };
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
