import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';
import { FDMatch, FDMatchesResponse } from '../types';

const fdAxios = axios.create({
  baseURL: 'https://api.football-data.org',
  headers: { 'X-Auth-Token': config.footballApiKey },
  timeout: 15000,
});

function todayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getTodaysMatches(): Promise<FDMatch[]> {
  const today = todayUTC();
  logger.debug('Fetching today\'s matches', { date: today });

  const response = await withRetry(
    () =>
      fdAxios.get<FDMatchesResponse>('/v4/competitions/WC/matches', {
        params: { dateFrom: today, dateTo: today },
      }),
    { maxAttempts: 3, baseDelayMs: 2000 },
    'getTodaysMatches'
  );

  const matches = response.data.matches.filter(
    (m) => m.status !== 'POSTPONED' && m.status !== 'CANCELLED' && m.status !== 'SUSPENDED'
  );

  logger.info(`Found ${matches.length} matches today`);
  return matches;
}

export async function getTeamLastNMatches(
  teamId: number,
  n: number = 5,
  // Delay before request — free tier allows 10 req/min
  delayMs: number = 6000
): Promise<FDMatch[]> {
  await sleep(delayMs);
  logger.debug('Fetching team form', { teamId, n });

  const response = await withRetry(
    () =>
      fdAxios.get<{ matches: FDMatch[] }>(`/v4/teams/${teamId}/matches`, {
        params: { status: 'FINISHED', limit: n },
      }),
    { maxAttempts: 3, baseDelayMs: 2000 },
    `getTeamForm-${teamId}`
  );

  // Most recent first
  return response.data.matches.sort(
    (a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime()
  );
}

export async function getMatchById(matchId: number): Promise<FDMatch> {
  logger.debug('Fetching match by id', { matchId });

  const response = await withRetry(
    () => fdAxios.get<FDMatch>(`/v4/matches/${matchId}`),
    { maxAttempts: 3, baseDelayMs: 2000 },
    `getMatch-${matchId}`
  );

  return response.data;
}

export function computeRestDays(
  lastMatchDate: string | undefined,
  currentMatchDate: Date
): number {
  if (!lastMatchDate) return 7;
  const last = new Date(lastMatchDate);
  const diffMs = currentMatchDate.getTime() - last.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}
