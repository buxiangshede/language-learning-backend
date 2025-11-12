import { createTool } from '@mastra/core/tools'
import OpenAI from 'openai'
import { z } from 'zod'
import { appConfig } from '../config'
import type { PracticeFeedback } from '../types/language'

const client = appConfig.openAIApiKey ? new OpenAI({ apiKey: appConfig.openAIApiKey }) : null

const practiceInputSchema = z.object({
  language: z.string(),
  nativeLanguage: z.string(),
  proficiency: z.enum(['beginner', 'intermediate', 'advanced']),
  focus: z.enum(['fluency', 'accuracy', 'confidence']),
  prompt: z.string().optional(),
  audioBase64: z.string().optional(),
  transcript: z.string().optional(),
})

const practiceOutputSchema = z.object({
  summary: z.string(),
  followUpQuestion: z.string(),
  transcript: z.string().optional(),
  scores: z.object({
    grammar: z.object({ score: z.number(), explanation: z.string() }),
    pronunciation: z.object({ score: z.number(), explanation: z.string() }),
    fluency: z.object({ score: z.number(), explanation: z.string() }),
  }),
  notes: z
    .array(
      z.object({
        title: z.string(),
        items: z.array(z.string()),
      }),
    )
    .default([]),
  practice: z.object({
    pronunciationDrill: z.string(),
    speakingPrompt: z.string(),
    encouragement: z.string(),
  }),
  pronunciationIssues: z.array(z.string()).default([]),
  grammarIssues: z.array(z.string()).default([]),
  correctedResponse: z.string(),
})

type PracticeInput = z.infer<typeof practiceInputSchema>

type PracticeOutput = z.infer<typeof practiceOutputSchema>

const transcribeAudio = async (audioBase64?: string): Promise<string | undefined> => {
  if (!audioBase64 || !client) return undefined
  const buffer = Buffer.from(audioBase64, 'base64')
  const file = await OpenAI.toFile(buffer, 'practice-input.webm')
  const transcription = await client.audio.transcriptions.create({
    file,
    model: 'gpt-4o-mini-transcribe',
    response_format: 'text',
  })
  if (typeof transcription === 'string') {
    return transcription
  }
  return (transcription as { text?: string }).text ?? undefined
}

const buildPrompt = (payload: PracticeInput, spokenText?: string): string => {
  const typed = payload.prompt?.trim()
  const transcript = payload.transcript?.trim() || spokenText?.trim()
  const blocks = [
    typed ? `Typed/context input:\n${typed}` : null,
    transcript ? `Transcribed speech:\n${transcript}` : null,
  ].filter(Boolean)
  const submission = blocks.length > 0 ? blocks.join('\n---\n') : 'Learner provided no content.'

  return `Target language: ${payload.language}
Native language: ${payload.nativeLanguage}
Proficiency: ${payload.proficiency}
Primary focus: ${payload.focus}
Learner submission (text + speech transcription):
${submission}

Tasks:
1. 点出 Learner 语音/文字中的主要 pronunciation issues（中文说明原因并提供单词拼写/IPA）。
2. 点出 grammar issues（中文说明问题并给出更好的句子片段）。
3. 给出一段 correctedResponse（自然英文句子）。
4. 给一个 follow up question 继续对话。

Respond ONLY with minified JSON exactly matching this schema:
{"summary":string,"followUpQuestion":string,"transcript":string,"scores":{"grammar":{"score":number,"explanation":string},"pronunciation":{"score":number,"explanation":string},"fluency":{"score":number,"explanation":string}},"notes":[{"title":string,"items":string[]}],"practice":{"pronunciationDrill":string,"speakingPrompt":string,"encouragement":string},"pronunciationIssues":string[],"grammarIssues":string[],"correctedResponse":string}
`
}

const parseResponse = (raw: string): PracticeOutput => {
  const trimmed = raw.trim()
  const withoutFence = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    : trimmed
  const json = JSON.parse(withoutFence)
  const result = practiceOutputSchema.parse(json)
  return result
}

export const practiceEvaluationTool = createTool({
  id: 'practice-evaluator',
  description: 'Evaluates learner speech and returns structured practice feedback.',
  inputSchema: practiceInputSchema,
  outputSchema: practiceOutputSchema,
  async execute(executionContext) {
    const input = practiceInputSchema.parse(executionContext.context)
    if (!client) {
      throw new Error('OpenAI client not configured for practice evaluator tool')
    }
    const spokenText = await transcribeAudio(input.audioBase64)
    const prompt = buildPrompt(input, spokenText)
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are an encouraging bilingual language coach. Provide concise actionable feedback and obey the response schema.',
        },
        { role: 'user', content: prompt },
      ],
    })
    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('Practice evaluator received empty response from LLM')
    }
    return parseResponse(content) as PracticeFeedback
  },
})
