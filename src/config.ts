import { config as loadEnv } from 'dotenv'

loadEnv()

const numberFromEnv = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const appConfig = {
  port: numberFromEnv(process.env.PORT, 8787),
  openAIApiKey: process.env.OPENAI_API_KEY ?? '',
  allowMockData: process.env.ALLOW_MOCK_DATA === 'true',
  logLevel: process.env.LOG_LEVEL ?? 'info',
}

if (!appConfig.openAIApiKey) {
  console.warn('[config] OPENAI_API_KEY 未配置，Mastra 将无法连通 GPT-4o-mini')
}
