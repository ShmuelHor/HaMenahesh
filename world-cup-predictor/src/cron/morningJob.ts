import cron from 'node-cron';
import { Prediction } from '../models/prediction.model';
import {
  getTodaysMatches,
  getTeamLastNMatches,
  computeRestDays,
} from '../services/football.service';
import { getMatchWeather } from '../services/weather.service';
import { getPrediction } from '../services/claude.service';
import {
  sendDailySummary,
  sendSystemError,
  sendNoMatchesToday,
} from '../services/telegram.service';
import { schedulePreMatchReminder } from './preMatchJob';
import { buildMatchPrompt, countryCodeToFlag } from '../utils/prompt.builder';
import { getFifaRanking } from '../utils/fifa-rankings';
import { getHebrewName } from '../utils/team-names';
import { logger } from '../utils/logger';
import { EnrichedMatch, IPrediction } from '../types';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runMorningJob(): Promise<void> {
  logger.info('Morning job started');

  const matches = await getTodaysMatches();

  if (!matches.length) {
    logger.info('No matches today');
    await sendNoMatchesToday();
    return;
  }

  logger.info(`Processing ${matches.length} matches`);
  const predictions: IPrediction[] = [];

  for (const match of matches) {
    const matchId = `fd-${match.id}`;

    try {
      // Skip if prediction already exists (idempotency guard)
      const existing = await Prediction.findOne({ matchId }).lean();
      if (existing) {
        logger.info('Prediction already exists, skipping', { matchId });
        predictions.push(existing as unknown as IPrediction);
        schedulePreMatchReminder(existing as unknown as IPrediction);
        continue;
      }

      logger.info(`Processing: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
      const matchDate = new Date(match.utcDate);

      // Fetch form with delays to respect the 10 req/min free-tier rate limit
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

      // Load recent history so Claude can learn from past performance
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
      schedulePreMatchReminder(predDoc);

      logger.info(`Prediction saved: ${match.homeTeam.name} ${claudeResult.home_score}–${claudeResult.away_score} ${match.awayTeam.name}`, {
        confidence: claudeResult.confidence,
      });

      // Brief pause to avoid hitting Claude rate limits between matches
      await sleep(2000);
    } catch (err) {
      // One match failing should not block the rest
      logger.error(`Failed to process match ${matchId}`, {
        error: err instanceof Error ? err.message : String(err),
      });
      await sendSystemError(`morning job - match ${matchId}`, err);
    }
  }

  if (predictions.length > 0) {
    const totalHistory = await Prediction.countDocuments({ resultFetched: true });
    const correctHistory = await Prediction.countDocuments({
      resultFetched: true,
      isCorrectWinner: true,
    });
    await sendDailySummary(predictions, correctHistory, totalHistory);
  }

  logger.info('Morning job completed', { processed: predictions.length });
}

export function registerMorningJob(): void {
  cron.schedule(
    '0 8 * * *',
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

  logger.info('Morning job registered (08:00 Israel time)');
}
