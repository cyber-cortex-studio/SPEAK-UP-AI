import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  __resetModelCacheForTests,
  GeminiClientError,
  sendCoachTurn,
} from './geminiClient'

const mockState = {
  groqKey: null as string | null,
  geminiKey: 'test-gemini-key' as string | null,
  pref: 'auto' as 'auto' | 'groq' | 'gemini',
}

vi.mock('./keyVault', () => ({
  GROQ_API_BASE: 'https://api.groq.com/openai/v1',
  getGroqApiKey: () => mockState.groqKey,
  getGeminiApiKey: () => mockState.geminiKey,
  getProviderPreference: () => mockState.pref,
}))

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('Unified Groq + Gemini multi-model auto-scanner & failover', () => {
  afterEach(() => {
    mockState.groqKey = null
    mockState.geminiKey = 'test-gemini-key'
    mockState.pref = 'auto'
    __resetModelCacheForTests()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('uses Groq dynamically across all available models and skips busy/rate-limited ones', async () => {
    mockState.groqKey = 'gsk_test_key'
    mockState.geminiKey = null

    const triedModels: string[] = []

    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.endsWith('/openai/v1/models')) {
        return jsonResponse({
          data: [
            { id: 'llama-3.3-70b-versatile', active: true },
            { id: 'llama-3.1-8b-instant', active: true },
            { id: 'whisper-large-v3-turbo', active: true },
          ],
        })
      }

      if (url.endsWith('/openai/v1/chat/completions')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as { model?: string }
        triedModels.push(body.model ?? '')
        if (body.model === 'llama-3.3-70b-versatile') {
          return jsonResponse({ error: { message: 'Rate limited' } }, 429)
        }
        if (body.model === 'llama-3.1-8b-instant') {
          return jsonResponse({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    learnerTranscript: 'Hi',
                    reply: 'Hey! Ready to practice English fast?',
                    bengaliHint: 'হ্যালো! চলো শুরু করি।',
                    bengaliBridgeUsed: false,
                    wordMeanings: [],
                    stuckChips: [],
                    completedObjectiveIds: [],
                    evidenceProposal: {
                      skill: 'speaking',
                      outcome: 'developing',
                      confidence: 'medium',
                    },
                  }),
                },
              },
            ],
          })
        }
      }

      return jsonResponse({}, 500)
    })

    vi.stubGlobal('fetch', fetchMock)

    const result = await sendCoachTurn({
      systemInstruction: 'Coach',
      history: [{ role: 'model', text: 'Hello!' }],
      userText: 'Hi',
    })

    expect(result.reply).toContain('Ready to practice English fast')
    expect(triedModels).toEqual(['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'])
  })

  it('automatically fails over from Groq to Gemini when all Groq models are busy in auto mode', async () => {
    mockState.groqKey = 'gsk_test_key'
    mockState.geminiKey = 'AIza_test_key'
    mockState.pref = 'auto'

    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input)

      if (url.includes('api.groq.com/openai/v1/models')) {
        return jsonResponse({ data: [{ id: 'llama-3.1-8b-instant', active: true }] })
      }
      if (url.includes('api.groq.com/openai/v1/chat/completions')) {
        return jsonResponse({ error: { message: 'Groq busy' } }, 503)
      }
      if (url.includes('generativelanguage.googleapis.com') && url.includes('/models?')) {
        return jsonResponse({
          models: [
            { name: 'models/gemma-3-27b-it', supportedGenerationMethods: ['generateContent'] },
          ],
        })
      }
      if (url.includes('gemma-3-27b-it:generateContent')) {
        return jsonResponse({
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                parts: [{ text: 'Hello from Gemini backup! How is your day going?' }],
              },
            },
          ],
        })
      }

      return jsonResponse({}, 500)
    })

    vi.stubGlobal('fetch', fetchMock)

    const result = await sendCoachTurn({
      systemInstruction: 'Coach',
      history: [],
      userText: 'Hello',
    })

    expect(result.reply).toContain('Hello from Gemini backup')
  })

  it('transcribes voice audio via Groq Whisper before calling Groq chat', async () => {
    mockState.groqKey = 'gsk_test_key'
    mockState.geminiKey = null

    let sawWhisper = false
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input)

      if (url.endsWith('/openai/v1/models')) {
        return jsonResponse({
          data: [
            { id: 'whisper-large-v3-turbo', active: true },
            { id: 'llama-3.1-8b-instant', active: true },
          ],
        })
      }
      if (url.endsWith('/openai/v1/audio/transcriptions')) {
        sawWhisper = true
        return jsonResponse({ text: 'I want to improve my English' })
      }
      if (url.endsWith('/openai/v1/chat/completions')) {
        return jsonResponse({
          choices: [
            {
              message: {
                content: 'That is a great goal! Tell me about your daily routine.',
              },
            },
          ],
        })
      }

      return jsonResponse({}, 500)
    })

    vi.stubGlobal('fetch', fetchMock)

    const result = await sendCoachTurn({
      systemInstruction: 'Coach',
      history: [],
      userAudio: { base64: 'AAAA', mimeType: 'audio/webm' },
    })

    expect(sawWhisper).toBe(true)
    expect(result.learnerTranscript).toBe('I want to improve my English')
    expect(result.reply).toContain('great goal')
  })

  it('returns clean server_busy error only when every available model is overloaded', async () => {
    mockState.groqKey = null
    mockState.geminiKey = 'AIza_test_key'

    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes('/models?')) {
        return jsonResponse({
          models: [
            { name: 'models/gemini-2.5-flash-lite', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemma-3-4b-it', supportedGenerationMethods: ['generateContent'] },
          ],
        })
      }
      return jsonResponse({ error: { message: 'High demand' } }, 503)
    })

    vi.stubGlobal('fetch', fetchMock)

    await expect(
      sendCoachTurn({
        systemInstruction: 'Coach',
        history: [],
        userText: 'Hello',
      }),
    ).rejects.toMatchObject({
      name: 'GeminiClientError',
      code: 'server_busy',
    } satisfies Partial<GeminiClientError>)
  })
})
