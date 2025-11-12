import crypto from 'node:crypto'

const AUDIO_CACHE = new Map<string, string>()

export const storeAudioPayload = (base64: string): string => {
  const id = crypto.randomUUID()
  AUDIO_CACHE.set(id, base64.trim())
  return id
}

export const consumeAudioPayload = (id: string): string | undefined => {
  const value = AUDIO_CACHE.get(id)
  if (value) {
    AUDIO_CACHE.delete(id)
  }
  return value
}
