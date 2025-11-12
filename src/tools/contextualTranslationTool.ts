import { createTool } from '@mastra/core/tools'
import OpenAI from 'openai'
import { z } from 'zod'
import { appConfig } from '../config'
import type { TranslationResponseBody } from '../types/language'

const client = appConfig.openAIApiKey ? new OpenAI({ apiKey: appConfig.openAIApiKey }) : null

const translationInputSchema = z.object({
  text: z.string().min(1),
  scene: z.string().optional(),
  tone: z.enum(['formal', 'neutral', 'friendly', 'concise']).optional(),
})

const translationOutputSchema = z.object({
  translation: z.string(),
  explanation: z.string(),
  alternatives: z.array(z.string()).default([]),
  glossary: z
    .array(
      z.object({
        term: z.string(),
        meaning: z.string(),
        note: z.string().optional(),
      }),
    )
    .default([]),
})

const parseResponse = (raw: string) => {
  const trimmed = raw.trim()
  const withoutFence = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    : trimmed
  return translationOutputSchema.parse(JSON.parse(withoutFence))
}

export const contextualTranslationTool = createTool({
  id: 'contextual-translation',
  description: 'Produces scene-aware English translations for Chinese inputs.',
  inputSchema: translationInputSchema,
  outputSchema: translationOutputSchema,
  async execute(executionContext) {
    if (!client) {
      throw new Error('OpenAI client not configured for translation tool')
    }
    const { text, scene, tone } = translationInputSchema.parse(executionContext.context)
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a bilingual localization specialist. Return ONLY JSON matching {"translation":string,"explanation":string,"alternatives":string[],"glossary":[{"term":string,"meaning":string,"note":string}]}.',
        },
        {
          role: 'user',
          content: `Chinese input: ${text}\nScene: ${scene || 'everyday conversation'}\nDesired tone: ${tone || 'neutral'}`,
        },
      ],
    })
    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('Translation tool received empty response from LLM')
    }
    return parseResponse(content) as TranslationResponseBody
  },
})
