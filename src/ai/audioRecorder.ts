export const MAX_RECORDING_MS = 60_000
export const MAX_AUDIO_BYTES = 1_024 * 1_024 // 1 MB hard cap
const TARGET_AUDIO_BITRATE = 16_000 // 16 kbps ultra-light for 2GB RAM Android devices

export interface RecordedAudio {
  base64: string
  mimeType: string
  sizeBytes: number
  durationSeconds: number
}

export type RecorderErrorCode =
  | 'unsupported'
  | 'permission_denied'
  | 'payload_too_large'
  | 'empty_recording'
  | 'recorder_failed'

export class AudioRecorderError extends Error {
  readonly code: RecorderErrorCode

  constructor(code: RecorderErrorCode, message: string) {
    super(message)
    this.name = 'AudioRecorderError'
    this.code = code
  }
}

let sharedAudioContext: AudioContext | null = null

export function unlockAudioContext(): void {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') {
    return
  }
  try {
    if (!sharedAudioContext) {
      sharedAudioContext = new window.AudioContext()
    }
    if (sharedAudioContext.state === 'suspended') {
      void sharedAudioContext.resume()
    }
  } catch {
    // Ignore autoplay unlock errors; explicit Play button remains available
  }
}

export function isRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  )
}

export function detectAndroidMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return ''
  }
  const androidCandidates = ['audio/webm;codecs=opus', 'audio/webm']
  for (const mime of androidCandidates) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime
    }
  }
  return ''
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new AudioRecorderError('recorder_failed', 'Failed to read audio blob'))
        return
      }
      const commaIndex = result.indexOf(',')
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result)
    }
    reader.onerror = () => {
      reject(new AudioRecorderError('recorder_failed', 'FileReader error'))
    }
    reader.readAsDataURL(blob)
  })
}

export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private chunks: Blob[] = []
  private startedAt = 0
  private autoStopTimer: number | null = null
  private activeMimeType = 'audio/webm'
  private isStopping = false

  private releaseHardware(): void {
    if (this.autoStopTimer !== null) {
      window.clearTimeout(this.autoStopTimer)
      this.autoStopTimer = null
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop())
      this.stream = null
    }
    this.mediaRecorder = null
    this.isStopping = false
  }

  isRecording(): boolean {
    return !this.isStopping && this.mediaRecorder !== null && this.mediaRecorder.state === 'recording'
  }

  async start(onAutoStop?: () => void): Promise<void> {
    if (!isRecordingSupported()) {
      throw new AudioRecorderError('unsupported', 'Microphone recording is not supported in this browser')
    }

    this.cancel()

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      throw new AudioRecorderError('permission_denied', 'Microphone permission was denied')
    }

    this.stream = stream
    this.chunks = []
    this.isStopping = false

    const preferredMime = detectAndroidMimeType()
    const options: MediaRecorderOptions = {
      audioBitsPerSecond: TARGET_AUDIO_BITRATE,
    }
    if (preferredMime) {
      options.mimeType = preferredMime
    }

    try {
      const recorder = new MediaRecorder(stream, options)
      this.activeMimeType = recorder.mimeType || preferredMime || 'audio/webm'
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.chunks.push(event.data)
        }
      }
      recorder.start()
      this.mediaRecorder = recorder
      this.startedAt = Date.now()

      this.autoStopTimer = window.setTimeout(() => {
        if (this.isRecording() && onAutoStop) {
          onAutoStop()
        }
      }, MAX_RECORDING_MS)
    } catch {
      this.releaseHardware()
      throw new AudioRecorderError('recorder_failed', 'Failed to initialize MediaRecorder')
    }
  }

  async stop(): Promise<RecordedAudio> {
    unlockAudioContext()

    const recorder = this.mediaRecorder
    if (this.isStopping || !recorder || recorder.state === 'inactive') {
      this.releaseHardware()
      throw new AudioRecorderError('empty_recording', 'No active recording to stop')
    }

    this.isStopping = true
    if (this.autoStopTimer !== null) {
      window.clearTimeout(this.autoStopTimer)
      this.autoStopTimer = null
    }

    const durationSeconds = Math.max(1, Math.round((Date.now() - this.startedAt) / 1000))
    const mimeType = this.activeMimeType

    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        const audioBlob = new Blob(this.chunks, { type: mimeType })
        this.chunks = []
        this.releaseHardware()
        resolve(audioBlob)
      }
      recorder.onerror = () => {
        this.chunks = []
        this.releaseHardware()
        reject(new AudioRecorderError('recorder_failed', 'Recording stopped with an error'))
      }
      recorder.stop()
    })

    if (blob.size === 0) {
      throw new AudioRecorderError('empty_recording', 'Recorded audio is empty')
    }
    if (blob.size > MAX_AUDIO_BYTES) {
      throw new AudioRecorderError('payload_too_large', 'Recorded audio exceeds 1 MB limit')
    }

    const base64 = await blobToBase64(blob)
    return {
      base64,
      mimeType: blob.type || mimeType,
      sizeBytes: blob.size,
      durationSeconds,
    }
  }

  cancel(): void {
    const recorder = this.mediaRecorder
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null
      recorder.onerror = null
      recorder.ondataavailable = null
      recorder.stop()
    }
    this.chunks = []
    this.releaseHardware()
  }
}
