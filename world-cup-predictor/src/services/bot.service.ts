import axios from 'axios';
import { config } from '../config';
import { checkAllServices } from './health.service';
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
  const statuses = await checkAllServices();
  const allOk = statuses.every((s) => s.ok);
  const lines = statuses.map((s) =>
    `${s.ok ? '✅' : '❌'} ${s.name}${s.ok ? '' : ` — ${s.error}`}`
  );
  const header = allOk ? '🟢 <b>כל המערכות פועלות</b>' : '🔴 <b>יש בעיות:</b>';
  await sendReply(chatId, `${header}\n\n${lines.join('\n')}`);
}

async function handleUpdate(update: Record<string, unknown>): Promise<void> {
  const message = update.message as Record<string, unknown> | undefined;
  if (!message) return;

  const text = (message.text as string | undefined)?.trim() ?? '';
  const chat = message.chat as Record<string, unknown>;
  const chatId = String(chat.id);

  if (chatId !== config.telegramAdminChatId) return;

  const command = text.split('@')[0].toLowerCase();

  if (command === '/status') {
    await handleStatus(chatId);
  }
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
        { command: 'status', description: 'בדיקת תקינות כל השירותים' },
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
