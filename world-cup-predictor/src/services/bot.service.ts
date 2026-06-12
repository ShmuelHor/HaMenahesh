import axios from 'axios';
import { config } from '../config';
import { checkAllServices } from './health.service';
import { sendMatchPrediction, sendYesterdaySummary, sendStatsTo } from './telegram.service';
import { runPostMatchCheck } from '../cron/postMatchJob';
import { Prediction } from '../models/prediction.model';
import { IPrediction } from '../types';
import { logger } from '../utils/logger';

const tgAxios = axios.create({
  baseURL: `https://api.telegram.org/bot${config.telegramBotToken}`,
  timeout: 35000,
});

let offset = 0;
let running = false;

async function sendReply(chatId: string, text: string): Promise<void> {
  await tgAxios.post('/sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  });
}

async function handleStatus(chatId: string): Promise<void> {
  logger.info('Status command received');
  try {
    const statuses = await checkAllServices();
    const allOk = statuses.every((s) => s.ok);
    const lines = statuses.map((s) =>
      `${s.ok ? '✅' : '❌'} ${s.name}${s.ok ? '' : ` — ${s.error}`}`
    );
    const header = allOk ? '🟢 <b>כל המערכות פועלות</b>' : '🔴 <b>יש בעיות:</b>';
    await sendReply(chatId, `${header}\n\n${lines.join('\n')}`);
  } catch {
    await sendReply(chatId, '❌ שגיאה בבדיקת השירותים.');
  }
}

async function handleSummary(chatId: string): Promise<void> {
  logger.info('Summary command received');
  try {
    await sendReply(chatId, '⏳ מאחזר נתונים...');
    await runPostMatchCheck();

    const now = new Date();
    const last24hStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const predictions = await Prediction.find({
      matchDate: { $gte: last24hStart, $lte: now },
    }).sort({ matchDate: 1 }).lean();

    if (!predictions.length) {
      await sendReply(chatId, 'ℹ️ לא היו משחקים ב-24 השעות האחרונות.');
      return;
    }

    const overallTotal = await Prediction.countDocuments({ resultFetched: true });
    const overallCorrect = await Prediction.countDocuments({ resultFetched: true, isCorrectWinner: true });
    const overallExact = await Prediction.countDocuments({ resultFetched: true, isExactScore: true });
    await sendYesterdaySummary(predictions as unknown as IPrediction[], overallCorrect, overallTotal, overallExact, chatId);
  } catch {
    await sendReply(chatId, '❌ שגיאה בשליפת הסיכום.');
  }
}

async function handleNext(chatId: string): Promise<void> {
  logger.info('Next command received');
  try {
    const now = new Date();
    const next = await Prediction.findOne({
      matchDate: { $gt: now },
      resultFetched: false,
    }).sort({ matchDate: 1 }).lean();

    if (!next) {
      await sendReply(chatId, 'ℹ️ אין משחקים קרובים עם ניחוש.');
      return;
    }

    await sendMatchPrediction(next as unknown as IPrediction, chatId);
  } catch {
    await sendReply(chatId, '❌ שגיאה בשליפת המשחק הקרוב.');
  }
}

async function handleStats(chatId: string): Promise<void> {
  logger.info('Stats command received');
  try {
    await sendStatsTo(chatId);
  } catch {
    await sendReply(chatId, '❌ שגיאה בשליפת הנתונים.');
  }
}

async function handleUpdate(update: Record<string, unknown>): Promise<void> {
  const message = update.message as Record<string, unknown> | undefined;
  if (!message) return;

  const text = (message.text as string | undefined)?.trim() ?? '';
  const chat = message.chat as Record<string, unknown>;
  const chatId = String(chat.id);

  if (chatId !== config.telegramAdminChatId) return;

  const command = text.split('@')[0].toLowerCase();

  if (command === '/status') await handleStatus(chatId);
  else if (command === '/summary') await handleSummary(chatId);
  else if (command === '/next') await handleNext(chatId);
  else if (command === '/stats') await handleStats(chatId);
}

async function pollLoop(): Promise<void> {
  while (running) {
    try {
      const response = await tgAxios.get<{ result: Record<string, unknown>[] }>('/getUpdates', {
        params: { offset, timeout: 30, allowed_updates: ['message'] },
      });

      for (const update of response.data.result) {
        try {
          await handleUpdate(update);
        } catch (err) {
          logger.error('Error handling bot update', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
        offset = (update.update_id as number) + 1;
      }
    } catch (err) {
      if (running) {
        logger.warn('Bot polling error, will retry', {
          error: err instanceof Error ? err.message : String(err),
        });
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }
}

async function registerCommands(): Promise<void> {
  try {
    await tgAxios.post('/setMyCommands', {
      commands: [
        { command: 'status',  description: 'בדיקת תקינות כל השירותים' },
        { command: 'summary', description: 'סיכום 24 השעות האחרונות' },
        { command: 'next',    description: 'המשחק הקרוב הבא' },
        { command: 'stats',   description: 'סטטיסטיקות כלליות מתחילת הטורניר' },
      ],
      scope: {
        type: 'chat',
        chat_id: parseInt(config.telegramAdminChatId, 10),
      },
    });
    logger.info('Bot commands registered');
  } catch (err) {
    logger.warn('Failed to register bot commands', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function startBotListener(): void {
  if (running) return;
  running = true;
  logger.info('Bot listener started');
  registerCommands().catch(() => {});
  pollLoop().catch((err) => {
    logger.error('Bot listener crashed', {
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

export function stopBotListener(): void {
  running = false;
  logger.info('Bot listener stopped');
}
