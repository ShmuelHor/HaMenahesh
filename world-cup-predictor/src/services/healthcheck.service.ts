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

async function check(name: string, fn: () => Promise<void>): Promise<ServiceStatus> {
  try {
    await fn();
    logger.info(`Health check passed: ${name}`);
    return { name, ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.warn(`Health check failed: ${name}`, { error });
    return { name, ok: false, error };
  }
}

export async function checkAllServices(): Promise<ServiceStatus[]> {
  const [mongo, football, claude, weather, telegram] = await Promise.all([

    check('MongoDB', async () => {
      if (!isConnected()) throw new Error('Not connected');
    }),

    check('football-data.org', async () => {
      await axios.get('https://api.football-data.org/v4/competitions/WC', {
        headers: { 'X-Auth-Token': config.footballApiKey },
        timeout: 8000,
      });
    }),

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
