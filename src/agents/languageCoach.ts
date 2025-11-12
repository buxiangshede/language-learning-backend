import { Agent } from '@mastra/core'
import { createOpenAI } from '@ai-sdk/openai'
import { appConfig } from '../config'
import { openAiVocabularyTool } from '../tools/openaiVocabularyTool'
import { openAiTranscriptionTool } from '../tools/openaiTranscriptionTool'
import { practiceEvaluationTool } from '../tools/practiceEvaluationTool'

const openai = createOpenAI({
  apiKey: appConfig.openAIApiKey || 'sk-example',
})

export const languageCoachAgent = new Agent({
  name: 'language-coach',
  description: 'Guides learners with pronunciation, vocabulary and reading drills.',
  instructions: {
    role: 'system',
    content:
      [
        'You are an encouraging language coach responsible for evaluating learner speech.',
        'Follow this workflow:',
        '1. If any user message references `Audio attachment ID: <uuid>` or contains base64 audio, call the `speech-transcriber` tool using either `{audioId}` or `{audioBase64}` to obtain a transcript before evaluating.',
        '2. Analyze the learner’s grammar, pronunciation and fluency, considering their proficiency level and practice focus.',
        '3. Respond ONLY with minified JSON using the exact schema:',
        '{"summary":string,"followUpQuestion":string,"transcript":string,"scores":{"grammar":{"score":number,"explanation":string},"pronunciation":{"score":number,"explanation":string},"fluency":{"score":number,"explanation":string}},"notes":[{"title":string,"items":string[]}],"practice":{"pronunciationDrill":string,"speakingPrompt":string,"encouragement":string}}',
        'Constraints:',
        '- scores must be integers between 0 and 100',
        '- keep `summary` concise and positive',
        '- every `notes` entry needs at least one actionable bullet (max 4 items each)',
        '- `pronunciationDrill` should be an imperative exercise <=110 characters',
        '- `speakingPrompt` must be an open-ended English question that nudges the next turn',
        '- `encouragement` should celebrate progress and invite the learner to continue',
      ].join('\n'),
  },
  model: openai('gpt-4o-mini'),
  tools: {
    vocabularyLookup: openAiVocabularyTool,
    speechTranscriber: openAiTranscriptionTool,
    practiceEvaluator: practiceEvaluationTool,
  },
})
