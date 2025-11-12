export type ProficiencyLevel = 'beginner' | 'intermediate' | 'advanced'
export type SpeakingFocus = 'fluency' | 'accuracy' | 'confidence'
export type TranslationTone = 'formal' | 'neutral' | 'friendly' | 'concise'

export interface PracticeRequestBody {
  language: string
  nativeLanguage: string
  proficiency: ProficiencyLevel
  focus: SpeakingFocus
  prompt?: string
  audioBase64?: string
  transcript?: string
}

export interface PracticeScoreDetail {
  score: number
  explanation: string
}

export interface PracticeFeedback {
  summary: string
  followUpQuestion: string
  transcript?: string
  scores: {
    grammar: PracticeScoreDetail
    pronunciation: PracticeScoreDetail
    fluency: PracticeScoreDetail
  }
  notes: Array<{
    title: string
    items: string[]
  }>
  practice: {
    pronunciationDrill: string
    speakingPrompt: string
    encouragement: string
  }
  pronunciationIssues: string[]
  grammarIssues: string[]
  correctedResponse: string
}

export interface VocabularyRequestBody {
  language: string
  word: string
}

export interface VocabularyResponseBody {
  entry: {
    word: string
    ipa?: string
    phoneticSpelling?: string
    partOfSpeech?: string
    definition: string
    example: string
    synonyms?: string[]
  }
  relatedWords: string[]
}

export interface TranslationRequestBody {
  text: string
  scene?: string
  tone?: TranslationTone
}

export interface TranslationResponseBody {
  translation: string
  explanation: string
  alternatives: string[]
  glossary: Array<{
    term: string
    meaning: string
    note?: string
  }>
}
