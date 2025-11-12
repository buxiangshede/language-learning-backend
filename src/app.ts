import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { languageRouter } from './routes/language'
import { logger } from './lib/logger'
import { mastra } from './mastra'

const app = new Hono()

app.use('*', cors({ origin: '*', allowHeaders: ['Content-Type'] }))

app.use('*', async (ctx, next) => {
  const requestId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  const start = Date.now()
  ctx.header('x-request-id', requestId)
  try {
    await next()
    logger.info(
      {
        requestId,
        method: ctx.req.method,
        path: ctx.req.path,
        status: ctx.res.status,
        durationMs: Date.now() - start,
      },
      'handled request',
    )
  } catch (error) {
    logger.error(
      {
        requestId,
        method: ctx.req.method,
        path: ctx.req.path,
        durationMs: Date.now() - start,
        error,
      },
      'request failed',
    )
    throw error
  }
})

app.get('/health', (ctx) => ctx.json({ status: 'ok', mastraReady: Boolean(mastra) }))
app.route('/api/language', languageRouter)

export { app }
