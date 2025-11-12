import { Hono } from 'hono'
import { z } from 'zod'
import {
  generatePracticeFeedback,
  queryVocabulary,
  generateContextualTranslation,
} from '../services/languageService'
import type {
  PracticeRequestBody,
  VocabularyRequestBody,
  TranslationRequestBody,
} from '../types/language'
import { logger } from '../lib/logger'

const practiceInput = z
  .object({
    language: z.string(),
    nativeLanguage: z.string(),
    proficiency: z.enum(['beginner', 'intermediate', 'advanced']),
    focus: z.enum(['fluency', 'accuracy', 'confidence']),
    prompt: z.string().optional(),
    audioBase64: z.string().min(20).optional(),
    transcript: z.string().optional(),
  })
  .refine(
    (data) =>
      Boolean(
        (data.prompt && data.prompt.trim().length > 0) ||
          (data.transcript && data.transcript.trim().length > 0) ||
          data.audioBase64,
      ),
    {
      message: '至少需要提供文本或语音输入',
      path: ['prompt'],
    },
  )

const vocabularyInput = z.object({
  language: z.string(),
  word: z.string().min(1),
})

const translationInput = z.object({
  text: z.string().min(2),
  scene: z.string().max(120).optional(),
  tone: z.enum(['formal', 'neutral', 'friendly', 'concise']).optional(),
})

export const languageRouter = new Hono()
  .post('/practice', async (ctx) => {
    const body = await ctx.req.json()
    const parsed = practiceInput.safeParse(body)
    if (!parsed.success) {
      return ctx.json({ error: parsed.error.flatten() }, 400)
    }

    try {
      const data = await generatePracticeFeedback(parsed.data as PracticeRequestBody)
      return ctx.json(data)
    } catch (error) {
      console.error('[language-route] practice failed', error)
      return ctx.json({ error: 'Language service temporarily unavailable.' }, 500)
    }
  })
  .post('/vocabulary', async (ctx) => {
    const body = await ctx.req.json()
    const parsed = vocabularyInput.safeParse(body)
    if (!parsed.success) {
      return ctx.json({ error: parsed.error.flatten() }, 400)
    }

    try {
      const data = await queryVocabulary(parsed.data as VocabularyRequestBody)
      return ctx.json(data)
    } catch (error) {
      console.error('[language-route] vocabulary failed', error)
      return ctx.json({ error: 'Language service temporarily unavailable.' }, 500)
    }
  })
  .post('/translation', async (ctx) => {
    const body = await ctx.req.json()
    const parsed = translationInput.safeParse(body)
    if (!parsed.success) {
      return ctx.json({ error: parsed.error.flatten() }, 400)
    }

    try {
      const data = await generateContextualTranslation(parsed.data as TranslationRequestBody)
      return ctx.json(data)
    } catch (error) {
      console.error('[language-route] translation failed', error)
      return ctx.json({ error: 'Language service temporarily unavailable.' }, 500)
    }
  })
