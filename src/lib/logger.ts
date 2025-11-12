import pino from 'pino'
import { appConfig } from '../config'

export const logger = pino({
  level: appConfig.logLevel,
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'UTC:yyyy-mm-dd HH:MM:ss.l',
            singleLine: true,
          },
        }
      : undefined,
})

export type Logger = typeof logger
