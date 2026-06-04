import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const isProduction = process.env.NODE_ENV === 'production';

const consoleFormat = isProduction
  ? winston.format.combine(winston.format.timestamp(), winston.format.json())
  : winston.format.combine(
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.colorize(),
      winston.format.printf(
        ({ timestamp, level, message, ...meta }) =>
          `[${timestamp}] ${level}: ${message}` +
          (Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '')
      )
    );

const fileTransport = new DailyRotateFile({
  filename: path.join('logs', 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxFiles: '14d',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
});

export const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
    fileTransport,
  ],
});

export function logError(context: string, err: unknown): void {
  if (err instanceof Error) {
    logger.error(context, { message: err.message, stack: err.stack });
  } else {
    logger.error(context, { raw: String(err) });
  }
}
