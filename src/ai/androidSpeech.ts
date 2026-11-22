export type SpeechRate = 0.75 | 1.0 | 1.2
export type VoiceGender = 'female' | 'male'

export interface AndroidVoiceOption {
  voiceURI: string
  name: string
  lang: string
  label: string
  isIndian: boolean
  gender: VoiceGender
}

const MAX_PER_GENDER = 4
const MALE_PITCH_PREFIX = 'male_pitch::'

const MALE_VOICE_TOKENS = [
  'male',
  'man',
  'david',
  'mark',
  'guy',
  'george',
  'daniel',
  'rishi',
  'aaron',
  'james',
  'ryan',
  'matthew',
  '-end-',
  '-ene-',
  '-tpd-',
  '-iom-',
  '-iol-',
  '-tpf-',
]

export function isAndroidSpeechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  )
}

function detectVoiceGender(voice: SpeechSynthesisVoice): VoiceGender {
  const combined = `${voice.name} ${voice.voiceURI}`.toLowerCase()
  if (combined.includes('female') || combined.includes('woman')) {
    return 'female'
  }
  for (const token of MALE_VOICE_TOKENS) {
    if (combined.includes(token)) {
      return 'male'
    }
  }
  return 'female'
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

function formatVoiceLabel(voice: SpeechSynthesisVoice, forcedGender?: VoiceGender): string {
  const lang = voice.lang.replace('_', '-')
  const cleanName = voice.name.replace(/\s*\([^)]*\)\s*/g, ' ').trim()
  const accentTag =
    lang.toLowerCase() === 'en-in'
      ? 'Indian'
      : lang.toLowerCase() === 'en-us'
        ? 'American'
        : lang
  if (forcedGender === 'male') {
    return `${accentTag} Male (${cleanName})`
  }
  return `${cleanName} (${accentTag})`
}

export function getAvailableEnglishVoices(): AndroidVoiceOption[] {
  if (!isAndroidSpeechSupported()) {
    return []
  }

  const allVoices = window.speechSynthesis.getVoices()
  const englishVoices = allVoices
    .filter((v) => v.lang.toLowerCase().startsWith('en'))
    .sort((a, b) => scoreEnglishVoice(b) - scoreEnglishVoice(a))

  const seen = new Set<string>()
  const females: AndroidVoiceOption[] = []
  const males: AndroidVoiceOption[] = []

  for (const voice of englishVoices) {
    if (seen.has(voice.voiceURI)) {
      continue
    }
    seen.add(voice.voiceURI)

    const normalizedLang = voice.lang.replace('_', '-')
    const gender = detectVoiceGender(voice)
    const option: AndroidVoiceOption = {
      voiceURI: voice.voiceURI,
      name: voice.name,
      lang: normalizedLang,
      label: formatVoiceLabel(voice),
      isIndian: normalizedLang.toLowerCase() === 'en-in',
      gender,
    }

    if (gender === 'male' && males.length < MAX_PER_GENDER) {
      males.push(option)
    } else if (gender === 'female' && females.length < MAX_PER_GENDER) {
      females.push(option)
    }
  }

  // Fallback: if device exposes no native male voice, create natural deeper-pitch Male options
  if (males.length === 0 && englishVoices.length > 0) {
    const indianBase = englishVoices.find((v) => v.lang.toLowerCase().replace('_', '-') === 'en-in')
    const usBase = englishVoices.find((v) => v.lang.toLowerCase().replace('_', '-') === 'en-us')
    const fallbackBases = [indianBase, usBase].filter(
      (v): v is SpeechSynthesisVoice => Boolean(v),
    )
    const bases = fallbackBases.length > 0 ? fallbackBases : [englishVoices[0]]

    for (const base of bases) {
      const normalizedLang = base.lang.replace('_', '-')
      males.push({
        voiceURI: `${MALE_PITCH_PREFIX}${base.voiceURI}`,
        name: base.name,
        lang: normalizedLang,
        label: formatVoiceLabel(base, 'male'),
        isIndian: normalizedLang.toLowerCase() === 'en-in',
        gender: 'male',
      })
    }
  }

  return [...females, ...males]
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
  synth.cancel()

  const isMalePitchFallback = Boolean(options.voiceURI?.startsWith(MALE_PITCH_PREFIX))
  const targetURI = isMalePitchFallback
    ? options.voiceURI?.slice(MALE_PITCH_PREFIX.length)
    : options.voiceURI

  const utterance = new SpeechSynthesisUtterance(trimmed)
  const rawVoices = synth.getVoices()

  let chosenVoice: SpeechSynthesisVoice | undefined
  if (targetURI) {
    chosenVoice = rawVoices.find((v) => v.voiceURI === targetURI)
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
  utterance.pitch = isMalePitchFallback ? 0.8 : 1.0

  utterance.onend = () => {
    options.onEnded?.()
  }
  utterance.onerror = () => {
    options.onError?.()
  }

  synth.speak(utterance)
  return true
}
