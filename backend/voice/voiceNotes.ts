/**
 * Voice notes: audio → transcript → hierarchical summary → sentiment clusters,
 * returned as a tree the client turns into note blocks.
 *
 *   POST /user/data/voice-notes   body: raw audio (Content-Type audio/webm, audio/mp4, …), ≤ 25 MB
 *   → { transcript, title, summary, clusters: [{ title, sentiment, summary, points }] }
 *
 * Long transcripts are summarized hierarchically: fixed-size chunks are each
 * summarized, then the chunk summaries are summarized together, so the final
 * summary and the clustering never see more than one model context.
 */

import type { Request, Response } from 'express'

export type Sentiment = 'positive' | 'negative' | 'neutral' | 'mixed'
export type VoiceCluster = { title: string; sentiment: Sentiment; summary: string; points: string[] }
export type VoiceNote = { transcript: string; title: string; summary: string; clusters: VoiceCluster[] }

export type VoiceDeps = {
  /** Audio bytes → transcript text. */
  transcribe(audio: Buffer, mimeType: string): Promise<string>
  /** Prompt → text (JSON when `json` is set, validated by the caller). */
  complete(system: string, user: string, json?: boolean): Promise<string>
  /** Words per chunk for hierarchical summarization. */
  chunkWords?: number
}

const SENTIMENTS: Sentiment[] = ['positive', 'negative', 'neutral', 'mixed']

export function chunkText(text: string, words: number): string[] {
  const all = text.split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  for (let i = 0; i < all.length; i += words) chunks.push(all.slice(i, i + words).join(' '))
  return chunks.length ? chunks : ['']
}

/** Summarize chunks, then summarize the summaries, until one summary remains. */
export async function summarizeHierarchically(deps: VoiceDeps, transcript: string): Promise<{ summary: string; levels: number }> {
  const words = deps.chunkWords ?? 900
  let pieces = chunkText(transcript, words)
  let levels = 0
  const system = 'You summarize spoken notes faithfully. Keep every distinct point, decision, question and name. Write compact prose, no preamble.'
  while (true) {
    levels++
    if (pieces.length === 1) {
      return { summary: await deps.complete(system, `Summarize this ${levels === 1 ? 'transcript' : 'set of partial summaries'}:\n\n${pieces[0]}`), levels }
    }
    const next: string[] = []
    for (const piece of pieces) next.push(await deps.complete(system, `Summarize this part of a longer recording:\n\n${piece}`))
    pieces = chunkText(next.join('\n\n'), words)
  }
}

function parseClusters(raw: string): Omit<VoiceNote, 'transcript'> {
  let data: unknown
  try { data = JSON.parse(raw) } catch { throw new Error('model returned invalid JSON') }
  const obj = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const clusters = Array.isArray(obj.clusters) ? obj.clusters : []
  return {
    title: String(obj.title ?? 'Voice note').slice(0, 120),
    summary: String(obj.summary ?? ''),
    clusters: clusters
      .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
      .map((c) => ({
        title: String(c.title ?? 'Untitled').slice(0, 120),
        sentiment: (SENTIMENTS.includes(c.sentiment as Sentiment) ? c.sentiment : 'neutral') as Sentiment,
        summary: String(c.summary ?? ''),
        points: Array.isArray(c.points) ? c.points.map((p) => String(p)).filter(Boolean).slice(0, 40) : []
      }))
      .slice(0, 20)
  }
}

export async function voiceNoteFromAudio(deps: VoiceDeps, audio: Buffer, mimeType: string): Promise<VoiceNote> {
  const transcript = (await deps.transcribe(audio, mimeType)).trim()
  if (!transcript) throw new Error('nothing was transcribed')
  const { summary } = await summarizeHierarchically(deps, transcript)
  const raw = await deps.complete(
    'You organize spoken notes. Group what was said into clusters of similar sentiment and topic. Respond with JSON only: {"title": string, "summary": string, "clusters": [{"title": string, "sentiment": "positive"|"negative"|"neutral"|"mixed", "summary": string, "points": string[]}]}. Points are short, concrete statements in the speaker\'s own terms; every substantive point in the transcript belongs to exactly one cluster.',
    `Overall summary:\n${summary}\n\nTranscript:\n${transcript}`,
    true
  )
  const organized = parseClusters(raw)
  return { transcript, ...organized, summary: organized.summary || summary }
}

/** Express handler; the raw body is the audio (see express.raw in index.ts). */
export function createVoiceNoteHandler(deps: VoiceDeps) {
  return async (req: Request, res: Response): Promise<Response> => {
    const raw = req.body as { length?: unknown } | undefined
    // express.raw gives a Buffer; accept any byte-array-like body (test environments may hand over another realm's Buffer)
    const audio = raw && typeof raw === 'object' && typeof raw.length === 'number' && raw.length > 0 ? Buffer.from(raw as unknown as Uint8Array) : null
    if (!audio) return res.status(400).json({ error: 'send the recording as the raw request body with an audio/* content type' })
    const mimeType = (req.header('content-type') ?? 'audio/webm').split(';')[0] as string
    try {
      const note = await voiceNoteFromAudio(deps, audio, mimeType)
      return res.json(note)
    } catch (error) {
      console.error('voice note failed:', error instanceof Error ? error.message : error)
      return res.status(502).json({ error: `transcription failed: ${error instanceof Error ? error.message : String(error)}` })
    }
  }
}

/** Production dependencies on OpenAI (loaded lazily so tests and local runs without a key still start). */
export function openAiVoiceDeps(): VoiceDeps {
  let clientPromise: Promise<any> | null = null
  const client = async () => {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured')
    if (!clientPromise) clientPromise = import('openai').then((m) => new (m.default ?? m.OpenAI)({ apiKey: process.env.OPENAI_API_KEY }))
    return clientPromise
  }
  return {
    async transcribe(audio, mimeType) {
      const openai = await client()
      const { toFile } = await import('openai')
      const ext = mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a' : mimeType.includes('mpeg') || mimeType.includes('mp3') ? 'mp3' : mimeType.includes('ogg') ? 'ogg' : mimeType.includes('wav') ? 'wav' : 'webm'
      const file = await toFile(audio, `voice.${ext}`, { type: mimeType })
      const result = await openai.audio.transcriptions.create({ file, model: process.env.VOICE_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe' })
      return typeof result === 'string' ? result : result.text ?? ''
    },
    async complete(system, user, json) {
      const openai = await client()
      const completion = await openai.chat.completions.create({
        model: process.env.VOICE_SUMMARY_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
      })
      return completion.choices?.[0]?.message?.content ?? ''
    }
  }
}
