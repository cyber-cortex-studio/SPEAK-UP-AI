import voicesData from '../content/voices.json'
import type { SpeechRate } from './geminiTts'

export type VoiceGender = 'female' | 'male'
export type VoiceProfileId = 'female_1' | 'female_2' | 'male_1' | 'male_2'
export type BengaliSupportLevel = 'high' | 'medium' | 'low'

export interface VoiceProfile {
  id: VoiceProfileId
  gender: VoiceGender
  displayName: string
  providerVoiceId: string
  locale: string
  enabled: boolean
}

export interface UserVoiceSettings {
  selectedGender: VoiceGender
  selectedProfileId: VoiceProfileId
  speechRate: SpeechRate
  voiceEnabled: boolean
  bengaliLevel: BengaliSupportLevel
}

const SETTINGS_KEY = 'speakup_voice_settings'

const DEFAULT_SETTINGS: UserVoiceSettings = {
  selectedGender: 'female',
  selectedProfileId: 'female_1',
  speechRate: 1.0,
  voiceEnabled: true,
  bengaliLevel: 'high',
}

export function getAllVoices(): VoiceProfile[] {
  return voicesData as VoiceProfile[]
}

export function getVoiceById(id: VoiceProfileId): VoiceProfile | undefined {
  return getAllVoices().find((v) => v.id === id)
}

export function loadVoiceSettings(): UserVoiceSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) {
      return { ...DEFAULT_SETTINGS }
    }
    const parsed = JSON.parse(raw) as Partial<UserVoiceSettings>
    return {
      selectedGender: parsed.selectedGender === 'male' ? 'male' : 'female',
      selectedProfileId:
        parsed.selectedProfileId === 'female_1' ||
        parsed.selectedProfileId === 'female_2' ||
        parsed.selectedProfileId === 'male_1' ||
        parsed.selectedProfileId === 'male_2'
          ? parsed.selectedProfileId
          : 'female_1',
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
