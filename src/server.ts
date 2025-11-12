import { serve } from '@hono/node-server'
import { app } from './app'
import { appConfig } from './config'
import { logger } from './lib/logger'

serve({ fetch: app.fetch, port: appConfig.port })
logger.info(`⚡️ Mastra language server running on http://localhost:${appConfig.port}`)
