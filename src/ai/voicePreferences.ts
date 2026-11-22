import type { SpeechRate } from './androidSpeech'

export type BengaliSupportLevel = 'high' | 'medium' | 'low'

export interface UserVoiceSettings {
  selectedVoiceURI: string
  speechRate: SpeechRate
  voiceEnabled: boolean
  bengaliLevel: BengaliSupportLevel
}

const SETTINGS_KEY = 'speakup_voice_settings_v2'

const DEFAULT_SETTINGS: UserVoiceSettings = {
  selectedVoiceURI: '',
  speechRate: 1.0,
  voiceEnabled: true,
  bengaliLevel: 'high',
}

export function loadVoiceSettings(): UserVoiceSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) {
      return { ...DEFAULT_SETTINGS }
    }
    const parsed = JSON.parse(raw) as Partial<UserVoiceSettings>

    return {
      selectedVoiceURI: typeof parsed.selectedVoiceURI === 'string' ? parsed.selectedVoiceURI : '',
      speechRate:
        parsed.speechRate === 0.75 || parsed.speechRate === 1.0 || parsed.speechRate === 1.2
          ? parsed.speechRate
          : 1.0,
      voiceEnabled: typeof parsed.voiceEnabled === 'boolean' ? parsed.voiceEnabled : true,
      bengaliLevel:
        parsed.bengaliLevel === 'high' ||
        parsed.bengaliLevel === 'medium' ||
        parsed.bengaliLevel === 'low'
          ? parsed.bengaliLevel
          : 'high',
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveVoiceSettings(settings: UserVoiceSettings): void {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}
