import { appConfig } from '../config'
import { logger } from '../lib/logger'
import { practiceEvaluationTool } from '../tools/practiceEvaluationTool'
import { openAiVocabularyTool } from '../tools/openaiVocabularyTool'
import { contextualTranslationTool } from '../tools/contextualTranslationTool'
import type {
  PracticeFeedback,
  PracticeRequestBody,
  VocabularyRequestBody,
  VocabularyResponseBody,
  TranslationRequestBody,
  TranslationResponseBody,
} from '../types/language'

const createToolContext = <T>(context: T) => ({
  context,
  runtimeContext: {} as any,
  suspend: async () => undefined,
})

const ensureExecute = <T extends { execute?: (...args: any[]) => Promise<any> }>(
  tool: T,
  name: string,
) => {
  if (!tool.execute) {
    throw new Error(`${name} tool execute handler is not defined`)
  }
  return tool.execute.bind(tool)
}

const practiceFallback: PracticeFeedback = {
  summary: 'Great job on your greeting! Your enthusiasm really shines through.',
  followUpQuestion: 'If you met a new teammate today, what would you ask to keep the chat flowing?',
  transcript: 'Hi there, I will going to the new gallery with my friend this weekend.',
  scores: {
    grammar: {
      score: 95,
      explanation: 'Grammar is strong overall; only minor tense slips appear when you describe future plans.',
    },
    pronunciation: {
      score: 85,
      explanation: 'Clear articulation, though the ending consonants in words like "meet" could be sharper.',
    },
    fluency: {
      score: 90,
      explanation: 'Smooth pacing with natural pauses, but you can add more detail to extend turns.',
    },
  },
  notes: [
    {
      title: 'Pronunciation',
      items: [
        'Work on sharper "t" sounds in "meet" and "night".',
        'Emphasize the "h" sound in "hello" so it does not disappear.',
      ],
    },
    {
      title: 'Fluency',
      items: [
        'Try adding a follow-up question after your greeting to keep the dialogue active.',
        'Mix short and longer sentences to create a more dynamic rhythm.',
      ],
    },
  ],
  practice: {
    pronunciationDrill: 'Repeat "Hello, nice to meet you" three times, focusing on crisp consonants.',
    speakingPrompt: 'Tell me about a recent conversation that made you smile.',
    encouragement: 'Keep up the great work! I cannot wait to hear your next recording.',
  },
  pronunciationIssues: [
    '“gallery” 中的 /ˈɡæl/ 重音需要更明显，结尾 /ri/ 轻读。',
    '句末 “friend” 的 /d/ 没有落地，建议着重收音。',
  ],
  grammarIssues: [
    '将 “I will going” 改成 “I am going to” 描述计划更自然。',
    '使用 “a few different dishes” 而不是 “a different foods”。',
  ],
  correctedResponse:
    'I am going to the new gallery with my friend this weekend and we plan to try a few different dishes afterward.',
}

const translationFallback: TranslationResponseBody = {
  translation: 'I really appreciate your help. Which day works best for you to meet?',
  explanation: 'Provides a polite, natural English tone suitable for most daily conversations.',
  alternatives: [
    'Thanks so much for your help. When would be a good time for us to meet?'
  ],
  glossary: [
    {
      term: 'appreciate your help',
      meaning: '表达感谢的地道说法',
      note: '比直接说 "thank you" 更真诚、更正式。',
    },
  ],
}

const stripCodeFence = (text: string) => {
  const trimmed = text.trim()
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
  }
  return trimmed
}

const parseJsonPayload = <T>(raw: string | undefined, operation: string): T | null => {
  if (!raw) return null
  try {
    return JSON.parse(stripCodeFence(raw)) as T
  } catch (error) {
    logger.warn({ operation, raw }, 'failed to parse structured response')
    return null
  }
}

const clampList = (items?: string[]) =>
  Array.from(new Set(items ?? []))
    .map((item) => item.trim())
    .filter((item) => Boolean(item))
    .slice(0, 6)

const normalizeVocabularyResponse = (data: VocabularyResponseBody): VocabularyResponseBody => ({
  entry: {
    ...data.entry,
    synonyms: data.entry.synonyms ? clampList(data.entry.synonyms) : undefined,
  },
  relatedWords: clampList(data.relatedWords),
})

const createVocabularyFallback = (word: string, language: string): VocabularyResponseBody => ({
  entry: {
    word,
    definition: `当前无法连接到语言服务，已返回 ${language} 释义的占位符，请稍后重试`,
    example: `Fallback response for "${word}" when the AI provider is unavailable.`,
    synonyms: [],
  },
  relatedWords: [],
})

const shouldMock = () => !appConfig.openAIApiKey || appConfig.allowMockData

logger.info({ appConfig }, 'language service init')

export async function generatePracticeFeedback(
  payload: PracticeRequestBody,
): Promise<PracticeFeedback> {
  const meta = {
    language: payload.language,
    nativeLanguage: payload.nativeLanguage,
    proficiency: payload.proficiency,
    focus: payload.focus,
    hasAudio: Boolean(payload.audioBase64),
  }

  if (shouldMock()) {
    logger.warn({ operation: 'practice', meta }, 'returning mock practice response')
    return practiceFallback
  }

  try {
    logger.info({ operation: 'practice', meta }, 'language service start')
    const executePractice = ensureExecute(practiceEvaluationTool, 'practice')
    const normalized = (await executePractice(createToolContext(payload))) as PracticeFeedback

    logger.info({ operation: 'practice' }, 'language service success')
    return normalized
  } catch (error) {
    logger.error({ operation: 'practice', meta, error }, 'language service error')
    if (appConfig.allowMockData) {
      logger.warn({ operation: 'practice' }, 'serving practice fallback due to failure')
      return practiceFallback
    }
    throw error
  }
}

export async function queryVocabulary(
  payload: VocabularyRequestBody,
): Promise<VocabularyResponseBody> {
  const meta = {
    word: payload.word,
    language: payload.language,
  }
  const fallback = createVocabularyFallback(payload.word, payload.language)

  if (shouldMock()) {
    logger.warn({ operation: 'vocabulary', meta }, 'returning mock vocabulary response')
    return fallback
  }

  try {
    logger.info({ operation: 'vocabulary', meta }, 'language service start')
    const executeVocab = ensureExecute(openAiVocabularyTool, 'vocabulary')
    const toolResult = await executeVocab(
      createToolContext({ word: payload.word, language: payload.language }),
    )

    const response: VocabularyResponseBody = {
      entry: {
        word: toolResult.entry.word || payload.word,
        definition:
          toolResult.entry.definition ||
          `No definition provided for "${payload.word}" due to provider response.`,
        example:
          toolResult.entry.example ||
          `Example unavailable for "${payload.word}" because the provider returned incomplete data.`,
        ipa: toolResult.entry.ipa,
        phoneticSpelling: toolResult.entry.phoneticSpelling,
        partOfSpeech: toolResult.entry.partOfSpeech,
        synonyms: toolResult.entry.synonyms?.map((item: string) => item.trim()).filter(Boolean),
      },
      relatedWords: toolResult.relatedWords.map((item: string) => item.trim()).filter(Boolean),
    }

    logger.info({ operation: 'vocabulary' }, 'language service success')
    return normalizeVocabularyResponse(response)
  } catch (error) {
    logger.error({ operation: 'vocabulary', meta, error }, 'language service error')
    if (appConfig.allowMockData) {
      logger.warn({ operation: 'vocabulary' }, 'serving vocabulary fallback due to failure')
      return fallback
    }
    throw error
  }
}

export async function generateContextualTranslation(
  payload: TranslationRequestBody,
): Promise<TranslationResponseBody> {
  if (shouldMock()) {
    logger.warn({ operation: 'translation', payload }, 'returning mock translation response')
    return translationFallback
  }

  try {
    logger.info({ operation: 'translation', payload }, 'language service start')
    const scene = payload.scene?.trim() || 'General conversation'
    const tone = payload.tone ?? 'neutral'

    const executeTranslation = ensureExecute(contextualTranslationTool, 'translation')
    const parsed = await executeTranslation(createToolContext({ text: payload.text, scene, tone }))

    const response: TranslationResponseBody = {
      translation: parsed.translation?.trim() || translationFallback.translation,
      explanation: parsed.explanation?.trim() || translationFallback.explanation,
      alternatives: parsed.alternatives
        .map((alt: string) => alt.trim())
        .filter(Boolean)
        .slice(0, 3),
      glossary: parsed.glossary
        .map((item: { term?: string; meaning?: string; note?: string }) => ({
          term: item.term?.trim() || '',
          meaning: item.meaning?.trim() || '',
          note: item.note?.trim(),
        }))
        .filter((entry: { term: string; meaning: string }) => entry.term && entry.meaning)
        .slice(0, 4),
    }

    logger.info({ operation: 'translation' }, 'language service success')
    return response
  } catch (error) {
    logger.error({ operation: 'translation', payload, error }, 'language service error')
    if (appConfig.allowMockData) {
      return translationFallback
    }
    throw error
  }
}
