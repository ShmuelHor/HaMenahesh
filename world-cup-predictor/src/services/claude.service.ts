import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { config } from '../config';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';
import { ClaudePredictionResponse } from '../types';

const client = new Anthropic({ apiKey: config.anthropicApiKey });

// System prompt is cached via cache_control: ephemeral.
// All predictions in a single morning run share the same block,
// so every call after the first hits the cache (~5 min TTL).
// The prompt content stays in Hebrew so Claude returns Hebrew reasoning.
const SYSTEM_PROMPT = `אתה מנתח כדורגל מקצועי ומומחה לגביע העולם. תפקידך לנחש תוצאות משחקים בצורה מדויקת ככל האפשר.

אתה מקבל נתונים על משחק: דירוג פיפ"א של כל קבוצה, פורמה אחרונה (5 משחקים), ימי מנוחה, ומזג אוויר.
בנוסף, אתה מקבל את היסטוריית הניחושים הקודמים שלך עם התוצאות האמיתיות — השתמש בזה כדי ללמוד ולשפר.

עקרונות הניחוש:
1. קבוצה עם דירוג גבוה יותר (מספר נמוך יותר) היא בדרך כלל חזקה יותר
2. פורמה אחרונה חשובה מאוד — 3+ ניצחונות רצופים הם סימן חיובי
3. ימי מנוחה פחות = עייפות גדולה יותר
4. מגרש נייטרלי — לא לתת יתרון בית
5. בגביע עולם, הפתעות קורות יותר מבליגות רגילות

תמיד ענה בJSON בלבד, ללא שום טקסט נוסף לפני או אחרי.
פורמט מחייב: {"home_score": NUMBER, "away_score": NUMBER, "confidence": NUMBER, "reasoning": "STRING"}
- home_score ו-away_score: מספרים שלמים בין 0 ל-5
- confidence: מספר שלם בין 30 ל-95 (אחוז ביטחון)
- reasoning: הסבר קצר בעברית (עד 100 מילים)`;

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

  // Extract JSON — handles cases where Claude wraps it in markdown fences
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
