import { createTool } from '@mastra/core/tools'
import OpenAI from 'openai'
import { z } from 'zod'
import { appConfig } from '../config'
import { logger } from '../lib/logger'
import { consumeAudioPayload } from './audioStore'

const client = appConfig.openAIApiKey ? new OpenAI({ apiKey: appConfig.openAIApiKey }) : null

const normalizeBase64 = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed.includes(',')) {
    return trimmed
  }
  const segments = trimmed.split(',')
  return segments[segments.length - 1]?.trim() ?? trimmed
}

export const openAiTranscriptionTool = createTool({
  id: 'speech-transcriber',
  description:
    'Transcribe base64 encoded webm/opus speech into text before evaluating pronunciation or grammar.',
  inputSchema: z.object({
    audioBase64: z.string().min(20).optional(),
    audioId: z.string().uuid().optional(),
    prompt: z.string().optional(),
  }),
  outputSchema: z.object({
    transcript: z.string(),
  }),
  async execute({ context }) {
    const requestedBase64 = context?.audioBase64?.trim()
    const audioPayload =
      requestedBase64 || (context?.audioId ? consumeAudioPayload(context.audioId) : undefined)
    if (!audioPayload) {
      logger.warn(
        { hasAudioBase64: Boolean(requestedBase64), audioId: context?.audioId },
        '[speech-transcriber] missing audio payload, returning empty transcript',
      )
      return { transcript: context?.prompt ?? '' }
    }
    if (!client) {
      logger.warn('[speech-transcriber] OPENAI_API_KEY 未配置，返回空转写')
      return { transcript: context?.prompt ?? '' }
    }
    try {
      const buffer = Buffer.from(normalizeBase64(audioPayload), 'base64')
      const file = await OpenAI.toFile(buffer, 'speech.webm')
      const transcription = await client.audio.transcriptions.create({
        file,
        model: 'gpt-4o-mini-transcribe',
        response_format: 'text',
        temperature: 0,
      })
      const text =
        typeof transcription === 'string'
          ? transcription
          : (transcription as { text?: string }).text ?? ''
      return { transcript: text.trim() }
    } catch (error) {
      logger.error({ error }, '[speech-transcriber] transcription failed')
      return { transcript: context?.prompt ?? '' }
    }
  },
})
