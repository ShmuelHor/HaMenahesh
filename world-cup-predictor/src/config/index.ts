import * as dotenv from 'dotenv';
import { AppConfig } from '../types';

dotenv.config();

const REQUIRED_KEYS = [
  'FOOTBALL_API_KEY',
  'ANTHROPIC_API_KEY',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'TELEGRAM_ADMIN_CHAT_ID',
  'OPENWEATHER_API_KEY',
] as const;

const missing = REQUIRED_KEYS.filter((key) => !process.env[key]?.trim());
if (missing.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missing.join(', ')}\n` +
      'Copy .env.example to .env and fill in all values.'
  );
}

export const config: AppConfig = {
  mongoUri: process.env.MONGO_URI ?? 'mongodb://mongo:27017/worldcup',
  footballApiKey: process.env.FOOTBALL_API_KEY!,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN!,
  telegramChatId: process.env.TELEGRAM_CHAT_ID!,
  telegramAdminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID!,
  openWeatherApiKey: process.env.OPENWEATHER_API_KEY!,
  claudeModel: process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  cronMorning: process.env.CRON_MORNING ?? '0 8 * * *',
  cronNight: process.env.CRON_NIGHT ?? '0 23 * * *',
  cronWeekly: process.env.CRON_WEEKLY ?? '0 20 * * 0',
  cronPostMatch: process.env.CRON_POST_MATCH ?? '*/30 * * * *',
  cronDailyHealth: process.env.CRON_DAILY_HEALTH ?? '0 9 * * *',
  preMatchReminderMinutes: parseInt(process.env.PRE_MATCH_REMINDER_MINUTES ?? '30', 10),
};
