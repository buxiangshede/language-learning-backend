import { createTool } from '@mastra/core/tools'
import OpenAI from 'openai'
import { z } from 'zod'
import { appConfig } from '../config'
import { logger } from '../lib/logger'

const openaiClient = new OpenAI({
  apiKey: appConfig.openAIApiKey || 'sk-placeholder',
})

const fallbackResponse = (word: string) => ({
  entry: {
    word,
    ipa: '/rəˈzɪl.jənt/',
    definition: 'Fallback response because OPENAI_API_KEY is not configured.',
    example: 'This fallback sentence appears when OpenAI access is missing.',
    synonyms: ['resilient', 'strong'],
  },
  relatedWords: [],
})

export const openAiVocabularyTool = createTool({
  id: 'openai-vocabulary-lookup',
  description:
    'Use OpenAI to retrieve English IPA, definition, synonyms and an example sentence for a given word.',
  inputSchema: z.object({
    word: z.string().min(1, 'word is required'),
    language: z.string().optional(),
  }),
  outputSchema: z.object({
    entry: z.object({
      word: z.string(),
      ipa: z.string().optional(),
      phoneticSpelling: z.string().optional(),
      partOfSpeech: z.string().optional(),
      definition: z.string(),
      example: z.string(),
      synonyms: z.array(z.string()).optional(),
    }),
    relatedWords: z.array(z.string()),
  }),
  async execute(executionContext) {
    const { word, language } = executionContext.context ?? {}
    if (!word) {
      throw new Error('word is required')
    }
    if (!appConfig.openAIApiKey) {
      return fallbackResponse(word)
    }

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are an English dictionary tool. Respond ONLY with JSON containing word, ipa, phoneticSpelling, partOfSpeech, definition, example, synonyms (array), relatedWords (array).',
        },
        {
          role: 'user',
          content: `word: ${word}\ntargetLanguage: ${language || 'Chinese'}\nInclude IPA, concise definition and example sentence.`,
        },
      ],
    })

    const raw = completion.choices[0]?.message?.content?.trim()
    logger.info(
      { word, language, rawLength: raw?.length || 0 },
      '[openai-vocabulary-lookup] received response',
    )
    if (!raw) {
      return fallbackResponse(word)
    }

    try {
      const parsed = JSON.parse(raw)
      return {
        entry: {
          word: parsed.word ?? word,
          ipa: parsed.ipa,
          phoneticSpelling: parsed.phoneticSpelling,
          partOfSpeech: parsed.partOfSpeech,
          definition: parsed.definition ?? 'No definition provided.',
          example: parsed.example ?? 'No example provided.',
          synonyms: Array.isArray(parsed.synonyms) ? parsed.synonyms : [],
        },
        relatedWords: Array.isArray(parsed.relatedWords) ? parsed.relatedWords : [],
      }
    } catch (error) {
      return fallbackResponse(word)
    }
  },
})
