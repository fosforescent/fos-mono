/**
 * Microphone recording across browsers and the native shells. Chrome/Firefox/Android record WebM/Opus; Safari and the
 * iOS app's WKWebView record only MP4 (AAC) and report `mimeType` late or not at all; old WebViews lack
 * `isTypeSupported`. The account accepts any `audio/*` body (backend/voice/voiceNotes.ts folds the aliases).
 */

/** Recording formats in order of preference: WebM/Opus where it exists, else MP4/AAC (iOS), else Ogg. */
export const RECORDING_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/aac', 'audio/ogg;codecs=opus', 'audio/ogg']

/** The type to ask MediaRecorder for, or undefined to let it choose (no `isTypeSupported`, or nothing listed is supported). */
export function recordingMimeType(recorder: { isTypeSupported?: (type: string) => boolean } | undefined = typeof MediaRecorder === 'undefined' ? undefined : MediaRecorder): string | undefined {
  if (typeof recorder?.isTypeSupported !== 'function') return undefined
  return RECORDING_TYPES.find(type => { try { return recorder.isTypeSupported!(type) } catch { return false } })
}

/** What the recording blob is: what the recorder reported, else what was asked for, else what its chunks say. iOS without any of these records MP4. */
export function recordedType(reported: string | undefined, requested: string | undefined, chunks: Array<{ type?: string }>, ios = isIos()): string {
  return reported || requested || chunks.find(c => c.type)?.type || (ios ? 'audio/mp4' : 'audio/webm')
}

export function isIos(): boolean {
  const nav = typeof navigator === 'undefined' ? undefined : navigator as Navigator & { maxTouchPoints?: number }
  if (!nav) return false
  return /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1)
}

/** Why recording cannot start here, or null when it can (checked before asking for the microphone). */
export function recordingUnsupported(): string | null {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return 'This browser or app does not allow microphone access here.'
  if (typeof MediaRecorder === 'undefined') return isIos() ? 'Recording needs iOS 14.3 or later.' : 'This browser cannot record audio.'
  return null
}

/** A user-facing message for a failed `getUserMedia` / `MediaRecorder` start. */
export function microphoneError(error: unknown): string {
  const name = error && typeof error === 'object' && 'name' in error ? String((error as { name: unknown }).name) : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return isIos() ? 'Microphone access is off for Fos. Turn it on in Settings › Privacy & Security › Microphone, then try again.' : 'Microphone access was denied. Allow it for this site, then try again.'
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'No microphone was found.'
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'The microphone is in use by another app.'
  if (name === 'NotSupportedError') return 'This browser cannot record audio in a format Fos accepts.'
  return `Microphone unavailable: ${error instanceof Error ? error.message : String(error)}`
}
