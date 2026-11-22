export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

export const GEMINI_COACH_MODEL = 'gemini-2.5-flash'

export function getGenerateContentUrl(model: string): string {
  return `${GEMINI_API_BASE}/${model}:generateContent`
}

export function getModelInfoUrl(model: string): string {
  return `${GEMINI_API_BASE}/${model}`
}
