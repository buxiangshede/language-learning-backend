import { Mastra } from '@mastra/core'
import { languageCoachAgent } from './agents/languageCoach'
import { translationAgent } from './agents/translationAgent'
import { vocabularyAgent } from './agents/vocabularyAgent'
import { speakingScorers } from './scorers/speakingScorers'

export const mastra = new Mastra({
  agents: {
    languageCoach: languageCoachAgent,
    contextualTranslator: translationAgent,
    vocabularyDictionary: vocabularyAgent,
  },
  scorers: speakingScorers,
})
