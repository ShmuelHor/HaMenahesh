import axios from 'axios';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { isConnected } from '../db/mongo';
import { logger } from '../utils/logger';

export interface ServiceStatus {
  name: string;
  ok: boolean;
  error?: string;
}

function isRetryable(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  if (!err.response) return true; // network error: no response at all
  return err.response.status >= 500; // server error: possibly transient
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function check(
  name: string,
  fn: () => Promise<unknown>,
  retry?: { attempts: number; delayMs: number }
): Promise<ServiceStatus> {
  const maxAttempts = retry?.attempts ?? 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await fn();
      logger.info(`Health check passed: ${name}`);
      return { name, ok: true };
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts && isRetryable(err)) {
        logger.warn(`Health check retry ${attempt}/${maxAttempts - 1}`, { name });
        await sleep(retry?.delayMs ?? 0);
      }
    }
  }

  const error = lastError instanceof Error ? lastError.message : String(lastError);
  logger.warn(`Health check failed: ${name}`, { error });
  return { name, ok: false, error };
}

export async function checkAllServices(): Promise<ServiceStatus[]> {
  const [mongo, football, claude, weather, telegram] = await Promise.all([

    check('MongoDB', async () => {
      if (!isConnected()) throw new Error('Not connected');
    }),

    check(
      'football-data.org',
      () => axios.get('https://api.football-data.org/v4/competitions/WC', {
        headers: { 'X-Auth-Token': config.footballApiKey },
        timeout: 8000,
      }),
      { attempts: 2, delayMs: 5000 }
    ),

    check('Claude API', async () => {
      const client = new Anthropic({ apiKey: config.anthropicApiKey });
      await client.models.list();
    }),

    check('OpenWeatherMap', async () => {
      await axios.get('https://api.openweathermap.org/data/2.5/weather', {
        params: { lat: 40.71, lon: -74.01, appid: config.openWeatherApiKey },
        timeout: 8000,
      });
    }),

    check('Telegram', async () => {
      await axios.get(
        `https://api.telegram.org/bot${config.telegramBotToken}/getMe`,
        { timeout: 8000 }
      );
    }),

  ]);

  return [mongo, football, claude, weather, telegram];
}
