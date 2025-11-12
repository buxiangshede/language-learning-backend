import { Agent } from '@mastra/core'
import { createOpenAI } from '@ai-sdk/openai'
import { appConfig } from '../config'
import { contextualTranslationTool } from '../tools/contextualTranslationTool'

const openai = createOpenAI({
  apiKey: appConfig.openAIApiKey || 'sk-example',
})

export const translationAgent = new Agent({
  name: 'contextual-translator',
  description: 'Provides natural Chinese to English translations with scenario awareness.',
  instructions: {
    role: 'system',
    content: [
      'You are a bilingual localization specialist.',
      'Given Chinese input, provide an idiomatic English rendering tailored to the described scene/tone.',
      'Always return minified JSON: {"translation":string,"explanation":string,"alternatives":string[],"glossary":[{"term":string,"meaning":string,"note":string}]}.',
      'Keep explanations concise yet actionable, mention cultural nuances when relevant.',
      'If no scene is provided, assume everyday conversation.',
    ].join('\n'),
  },
  model: openai('gpt-4o-mini'),
  tools: {
    contextualTranslation: contextualTranslationTool,
  },
})
