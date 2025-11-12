import { Agent } from '@mastra/core'
import { createOpenAI } from '@ai-sdk/openai'
import { appConfig } from '../config'
import { openAiVocabularyTool } from '../tools/openaiVocabularyTool'

const openai = createOpenAI({
  apiKey: appConfig.openAIApiKey || 'sk-example',
})

export const vocabularyAgent = new Agent({
  name: 'vocabulary-dictionary',
  description: 'Returns bilingual dictionary entries with IPA and usage notes.',
  instructions: {
    role: 'system',
    content: [
      'You are a precise bilingual dictionary.',
      'Always respond with minified JSON: {"entry":{"word":string,"ipa":string,"phoneticSpelling":string,"partOfSpeech":string,"definition":string,"example":string,"synonyms":string[]},"relatedWords":string[]}.',
      'Definitions must be concise and aligned with the requested target language.',
      'Provide at least one synonym when possible and ensure example sentences are natural.',
    ].join('\n'),
  },
  model: openai('gpt-4o-mini'),
  tools: {
    openAiVocabulary: openAiVocabularyTool,
  },
})
