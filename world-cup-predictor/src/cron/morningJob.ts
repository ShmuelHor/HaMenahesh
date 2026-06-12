import cron from 'node-cron';
import { config } from '../config';
import { Prediction } from '../models/prediction.model';
import {
  getMatchesInWindow,
  getTeamLastNMatches,
  computeRestDays,
} from '../services/football.service';
import { getMatchWeather } from '../services/weather.service';
import { getPrediction } from '../services/claude.service';
import {
  sendMatchPrediction,
  sendSystemError,
  sendNoMatchesToday,
  sendYesterdaySummary,
} from '../services/telegram.service';
import { buildMatchPrompt, countryCodeToFlag } from '../utils/prompt.builder';
import { getFifaRanking } from '../utils/fifa-rankings';
import { getHebrewName } from '../utils/team-names';
import { logger } from '../utils/logger';
import { EnrichedMatch, IPrediction } from '../types';
import { runPostMatchCheck } from './postMatchJob';

const { cronMorning } = config;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runMorningJob(): Promise<void> {
  logger.info('Morning job started');

  const now = new Date();
  const last24hStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const next24hEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // 1. Fetch any outstanding results from the last 24h into MongoDB
  await runPostMatchCheck();

  // 2. Send summary of last 24 hours
  const recentPredictions = await Prediction.find({
    matchDate: { $gte: last24hStart, $lte: now },
  })
    .sort({ matchDate: 1 })
    .lean();

  if (recentPredictions.length > 0) {
    const overallTotal = await Prediction.countDocuments({ resultFetched: true });
    const overallCorrect = await Prediction.countDocuments({ resultFetched: true, isCorrectWinner: true });
    const overallExact = await Prediction.countDocuments({ resultFetched: true, isExactScore: true });
    await sendYesterdaySummary(
      recentPredictions as unknown as IPrediction[],
      overallCorrect,
      overallTotal,
      overallExact
    );
  }

  // 3. Predictions for next 24 hours
  const matches = await getMatchesInWindow(now, next24hEnd);

  if (!matches.length) {
    logger.info('No matches in next 24 hours');
    await sendNoMatchesToday();
    logger.info('Morning job completed', { processed: 0 });
    return;
  }

  logger.info(`Processing ${matches.length} matches`);
  const predictions: IPrediction[] = [];

  for (const match of matches) {
    const matchId = `fd-${match.id}`;

    try {
      const existing = await Prediction.findOne({ matchId }).lean();
      if (existing) {
        logger.info('Prediction already exists, skipping', { matchId });
        predictions.push(existing as unknown as IPrediction);
        continue;
      }

      logger.info(`Processing: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
      const matchDate = new Date(match.utcDate);

      const homeForm = await getTeamLastNMatches(match.homeTeam.id, 5, 6000);
      const awayForm = await getTeamLastNMatches(match.awayTeam.id, 5, 6000);

      const restDaysHome = computeRestDays(homeForm[0]?.utcDate, matchDate);
      const restDaysAway = computeRestDays(awayForm[0]?.utcDate, matchDate);

      const weather = await getMatchWeather(match.venue, matchDate);

      const enriched: EnrichedMatch = {
        match,
        homeForm,
        awayForm,
        restDaysHome,
        restDaysAway,
        weather,
      };

      const history = await Prediction.find({ resultFetched: true })
        .sort({ matchDate: -1 })
        .limit(10)
        .lean();

      const userMessage = buildMatchPrompt(enriched, history as unknown as IPrediction[]);
      const claudeResult = await getPrediction(userMessage);

      const homeFlag = countryCodeToFlag(match.homeTeam.tla);
      const awayFlag = countryCodeToFlag(match.awayTeam.tla);
      const homeRank = getFifaRanking(match.homeTeam.tla);
      const awayRank = getFifaRanking(match.awayTeam.tla);

      const saved = await Prediction.create({
        matchId,
        homeTeam: getHebrewName(match.homeTeam.tla, match.homeTeam.name),
        awayTeam: getHebrewName(match.awayTeam.tla, match.awayTeam.name),
        homeFlag,
        awayFlag,
        matchDate,
        venue: match.venue ?? '',
        stage: match.stage,
        group: match.group ?? null,
        homeRank,
        awayRank,
        predictedHome: claudeResult.home_score,
        predictedAway: claudeResult.away_score,
        confidence: claudeResult.confidence,
        reasoning: claudeResult.reasoning,
        resultFetched: false,
        preMatchNotified: false,
        postMatchNotified: false,
        createdAt: new Date(),
      });

      const predDoc = saved.toObject() as unknown as IPrediction;
      predictions.push(predDoc);

      logger.info(`Prediction saved: ${match.homeTeam.name} ${claudeResult.home_score}–${claudeResult.away_score} ${match.awayTeam.name}`, {
        confidence: claudeResult.confidence,
      });

      await sleep(2000);
    } catch (err) {
      logger.error(`Failed to process match ${matchId}`, {
        error: err instanceof Error ? err.message : String(err),
      });
      await sendSystemError(`morning job - match ${matchId}`, err);
    }
  }

  for (const pred of predictions) {
    await sendMatchPrediction(pred);
  }

  logger.info('Morning job completed', { processed: predictions.length });
}

export function registerMorningJob(): void {
  cron.schedule(
    cronMorning,
    async () => {
      try {
        await runMorningJob();
      } catch (err) {
        logger.error('Morning job critical failure', {
          error: err instanceof Error ? err.message : String(err),
        });
        await sendSystemError('morning job - critical failure', err);
      }
    },
    { timezone: 'Asia/Jerusalem' }
  );

  logger.info(`Morning job registered (${cronMorning})`);
}
