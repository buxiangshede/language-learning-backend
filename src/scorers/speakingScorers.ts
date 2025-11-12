import { createScorer } from '@mastra/core/scores'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'
import { appConfig } from '../config'

const openai = createOpenAI({
  apiKey: appConfig.openAIApiKey || 'sk-example',
})

const speakingScoreSchema = z.object({
  rawScore: z.number().min(0).max(100),
  explanation: z.string().min(1),
})

type SpeakingDimension = 'Grammar' | 'Pronunciation' | 'Fluency'

const stringifyMessages = (messages: unknown): string => {
  if (!Array.isArray(messages)) return ''
  return messages
    .map((message) => {
      const content = (message as { content?: unknown })?.content
      if (typeof content === 'string') return content
      if (Array.isArray(content)) {
        return content
          .map((part) => {
            if (typeof part === 'string') return part
            if (typeof part === 'object' && part && 'text' in part && typeof part.text === 'string') {
              return part.text
            }
            return ''
          })
          .filter(Boolean)
          .join('\n')
      }
      if (content && typeof content === 'object') {
        try {
          return JSON.stringify(content)
        } catch {
          return ''
        }
      }
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

const createSpeakingScorer = (dimension: SpeakingDimension, rubric: string) =>
  createScorer({
    name: `${dimension} Score`,
    description: `LLM-judged ${dimension.toLowerCase()} rating for speaking practice.`,
    type: 'agent',
    judge: {
      model: openai('gpt-4o-mini'),
      instructions: [
        `You are an expert speaking coach focusing on ${dimension.toLowerCase()}.`,
        rubric,
        'Only return JSON that matches the requested schema.',
      ].join(' '),
    },
  })
    .preprocess(({ run }) => {
      const learnerText = stringifyMessages(run.input?.inputMessages)
      const coachResponse = Array.isArray(run.output)
        ? stringifyMessages(run.output)
        : ''
      return { learnerText, coachResponse }
    })
    .analyze({
      description: `Rate ${dimension.toLowerCase()} from 0-100`,
      outputSchema: speakingScoreSchema,
      createPrompt: ({ results }) => {
        const input = results.preprocessStepResult?.learnerText ?? ''
        const response = results.preprocessStepResult?.coachResponse ?? ''
        return `
Evaluate the learner's ${dimension.toLowerCase()} for the provided speaking attempt.
Learner submission:
"""
${input}
"""
Coach feedback:
"""
${response}
"""
Return JSON: {"rawScore": number (0-100), "explanation": string}
Consider clarity, accuracy, and appropriateness for the learner's level.`
      },
    })
    .generateScore(({ results }) => {
      const score = results.analyzeStepResult?.rawScore ?? 50
      return Math.min(1, Math.max(0, score / 100))
    })
    .generateReason(({ results }) => {
      const explanation = results.analyzeStepResult?.explanation ?? 'No explanation provided.'
      const score = results.analyzeStepResult?.rawScore ?? 'n/a'
      return `${dimension} evaluation (${score}/100): ${explanation}`
    })

export const grammarScorer = createSpeakingScorer(
  'Grammar',
  'Penalize incorrect verb tenses, agreement errors, or unnatural structures. Reward accurate sentence formation.',
)

export const pronunciationScorer = createSpeakingScorer(
  'Pronunciation',
  'Focus on intelligibility, stress, rhythm, and clarity of vowel/consonant sounds. Consider the learner’s accent but emphasize understandability.',
)

export const fluencyScorer = createSpeakingScorer(
  'Fluency',
  'Assess smoothness, pacing, use of fillers, and ability to maintain coherent speech without long pauses.',
)

export const speakingScorers = {
  grammarScorer,
  pronunciationScorer,
  fluencyScorer,
}
