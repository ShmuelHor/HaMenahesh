import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { config } from '../config';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';
import { ClaudePredictionResponse } from '../types';

const client = new Anthropic({ apiKey: config.anthropicApiKey });

// System prompt in English for optimal reasoning quality.
// The `reasoning` field in the JSON response is requested in Hebrew
// so it can be displayed directly in Telegram messages.
const SYSTEM_PROMPT = `You are a professional football analyst specializing in FIFA World Cup tournaments.
Your task is to predict match results as accurately as possible using the data provided.

You receive for each match:
- FIFA world ranking of each team (lower number = stronger team)
- Recent form: last 5 matches (W = Win, D = Draw, L = Loss)
- Rest days since each team's last match
- Weather conditions at the venue
- Your own past prediction history with actual outcomes — learn from your mistakes

Prediction guidelines:
1. FIFA ranking is a strong baseline indicator of team quality
2. Recent form matters heavily — 3+ consecutive wins is a strong positive signal
3. Fewer rest days = higher fatigue risk, especially in a compressed tournament schedule
4. All matches are on neutral venues — no home advantage applies
5. World Cup group stage produces more upsets than knockout rounds
6. A team eliminated from advancement may field a weaker lineup in the final group game

Output format:
- Reply with a single JSON object — no markdown, no explanation outside the JSON
- Required schema: {"home_score": NUMBER, "away_score": NUMBER, "confidence": NUMBER, "reasoning": "STRING"}
- home_score / away_score: integers 0–5
- confidence: integer 30–95 (your estimated probability the predicted outcome is correct)
- reasoning: 1–3 sentences in Hebrew explaining the key factors behind your prediction`;

const ClaudePredictionSchema = z.object({
  home_score: z.number().int().min(0).max(10),
  away_score: z.number().int().min(0).max(10),
  confidence: z.number().int().min(0).max(100),
  reasoning: z.string().min(5),
});

export async function getPrediction(
  userMessage: string
): Promise<ClaudePredictionResponse> {
  logger.debug('Sending prediction request to Claude');

  const response = await withRetry(
    () =>
      client.messages.create({
        model: config.claudeModel,
        max_tokens: 512,
        system: [
          {
            type: 'text' as const,
            text: SYSTEM_PROMPT,
            // Cached for ~5 min — all matches in a morning run share this block
            cache_control: { type: 'ephemeral' as const },
          },
        ],
        messages: [{ role: 'user' as const, content: userMessage }],
      }),
    { maxAttempts: 3, baseDelayMs: 5000 },
    'claude-prediction'
  );

  const rawText =
    response.content[0]?.type === 'text' ? response.content[0].text : '';

  const usage = response.usage as unknown as Record<string, number>;
  logger.debug('Claude response received', {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheRead: usage['cache_read_input_tokens'] ?? 0,
    cacheCreation: usage['cache_creation_input_tokens'] ?? 0,
  });

  // Extract JSON — handles cases where Claude wraps output in markdown fences
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Claude returned no JSON: ${rawText.slice(0, 200)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error(`Claude returned invalid JSON: ${jsonMatch[0].slice(0, 200)}`);
  }

  const validated = ClaudePredictionSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`Claude response failed schema validation: ${validated.error.message}`);
  }

  logger.info('Prediction received from Claude', {
    home: validated.data.home_score,
    away: validated.data.away_score,
    confidence: validated.data.confidence,
  });

  return validated.data;
}
