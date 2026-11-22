export type SpeechRate = 0.75 | 1.0 | 1.2

export interface AndroidVoiceOption {
  voiceURI: string
  name: string
  lang: string
  label: string
  isIndian: boolean
}

const MAX_ENGLISH_VOICES = 8

export function isAndroidSpeechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  )
}

function scoreEnglishVoice(voice: SpeechSynthesisVoice): number {
  const lang = voice.lang.toLowerCase().replace('_', '-')
  const name = voice.name.toLowerCase()
  let score = 0

  if (lang === 'en-in') {
    score += 100
  } else if (lang === 'en-us') {
    score += 70
  } else if (lang === 'en-gb') {
    score += 50
  } else if (lang.startsWith('en')) {
    score += 20
  }

  if (name.includes('google')) {
    score += 25
  }
  if (voice.localService) {
    score += 10
  }
  return score
}

function formatVoiceLabel(voice: SpeechSynthesisVoice): string {
  const lang = voice.lang.replace('_', '-')
  const cleanName = voice.name.replace(/\s*\([^)]*\)\s*/g, ' ').trim()
  const accentTag = lang.toLowerCase() === 'en-in' ? 'Indian' : lang.toLowerCase() === 'en-us' ? 'American' : lang
  return `${cleanName} (${accentTag})`
}

export function getAvailableEnglishVoices(): AndroidVoiceOption[] {
  if (!isAndroidSpeechSupported()) {
    return []
  }

  const allVoices = window.speechSynthesis.getVoices()
  const englishVoices = allVoices.filter((v) => v.lang.toLowerCase().startsWith('en'))

  const sorted = [...englishVoices].sort((a, b) => scoreEnglishVoice(b) - scoreEnglishVoice(a))

  const seen = new Set<string>()
  const result: AndroidVoiceOption[] = []

  for (const voice of sorted) {
    if (seen.has(voice.voiceURI)) {
      continue
    }
    seen.add(voice.voiceURI)
    const normalizedLang = voice.lang.replace('_', '-')
    result.push({
      voiceURI: voice.voiceURI,
      name: voice.name,
      lang: normalizedLang,
      label: formatVoiceLabel(voice),
      isIndian: normalizedLang.toLowerCase() === 'en-in',
    })
    if (result.length >= MAX_ENGLISH_VOICES) {
      break
    }
  }

  return result
}

export function subscribeVoicesChanged(onChange: () => void): () => void {
  if (!isAndroidSpeechSupported()) {
    return () => {}
  }

  const synth = window.speechSynthesis
  if (typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', onChange)
    return () => synth.removeEventListener('voiceschanged', onChange)
  }

  synth.onvoiceschanged = onChange
  return () => {
    if (synth.onvoiceschanged === onChange) {
      synth.onvoiceschanged = null
    }
  }
}

export function stopAndroidSpeech(): void {
  if (!isAndroidSpeechSupported()) {
    return
  }
  window.speechSynthesis.cancel()
}

export interface AndroidSpeakOptions {
  text: string
  voiceURI?: string
  rate: SpeechRate
  onEnded?: () => void
  onError?: () => void
}

export function speakWithAndroidVoice(options: AndroidSpeakOptions): boolean {
  const trimmed = options.text.trim()
  if (!trimmed || !isAndroidSpeechSupported()) {
    return false
  }

  const synth = window.speechSynthesis
  // Clear any stuck speech queue on Android Chrome before speaking
  synth.cancel()

  const utterance = new SpeechSynthesisUtterance(trimmed)
  const rawVoices = synth.getVoices()

  let chosenVoice: SpeechSynthesisVoice | undefined
  if (options.voiceURI) {
    chosenVoice = rawVoices.find((v) => v.voiceURI === options.voiceURI)
  }
  if (!chosenVoice) {
    const englishVoices = rawVoices
      .filter((v) => v.lang.toLowerCase().startsWith('en'))
      .sort((a, b) => scoreEnglishVoice(b) - scoreEnglishVoice(a))
    chosenVoice = englishVoices[0]
  }

  if (chosenVoice) {
    utterance.voice = chosenVoice
    utterance.lang = chosenVoice.lang
  } else {
    utterance.lang = 'en-IN'
  }

  utterance.rate = options.rate
  utterance.pitch = 1.0

  utterance.onend = () => {
    options.onEnded?.()
  }
  utterance.onerror = () => {
    options.onError?.()
  }

  synth.speak(utterance)
  return true
}
