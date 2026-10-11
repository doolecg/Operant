import { useCallback, useEffect, useRef, useState } from 'react'
import { SPEECH_MODEL, markSpeechModelInstalled } from '@/lib/speechModel'
import ortMjsUrl from '../../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs?url'
import ortWasmUrl from '../../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm?url'

export type DictationState = 'idle' | 'recording' | 'loading' | 'transcribing'

const MODEL = SPEECH_MODEL
const SAMPLE_RATE = 16000

type Transcriber = (audio: Float32Array) => Promise<{ text: string } | { text: string }[]>

// One pipeline for the whole app: the model is fetched once (then cached by the browser) and runs fully on this device.
let transcriber: Promise<Transcriber> | null = null

// Downloads and loads the speech model now (the Install page and first-start setup call this).
export function preloadSpeechModel(): Promise<unknown> {
  return loadTranscriber()
}

function loadTranscriber(): Promise<Transcriber> {
  transcriber ??= import('@huggingface/transformers')
    .then(async ({ pipeline, env }) => {
      env.allowLocalModels = false
      env.useBrowserCache = true
      // Serve the speech runtime from the app itself: the CSP blocks the CDN default and blob: scripts.
      env.useWasmCache = false
      const onnx = env.backends.onnx.wasm
      if (onnx) onnx.wasmPaths = { mjs: new URL(ortMjsUrl, location.href).href, wasm: new URL(ortWasmUrl, location.href).href }
      const p = await pipeline('automatic-speech-recognition', MODEL)
      markSpeechModelInstalled()
      return (audio: Float32Array) => p(audio) as Promise<{ text: string } | { text: string }[]>
    })
    .catch((e: unknown) => {
      transcriber = null
      throw e
    })
  return transcriber
}

export function joinChunks(chunks: readonly Float32Array[]): Float32Array {
  const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0))
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  return out
}

export function useDictation(onText: (text: string) => void) {
  const [state, setState] = useState<DictationState>('idle')
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<{ stream: MediaStream; ctx: AudioContext; node: ScriptProcessorNode; chunks: Float32Array[] } | null>(null)
  const onTextRef = useRef(onText)
  onTextRef.current = onText

  const release = useCallback(() => {
    const r = rec.current
    rec.current = null
    if (!r) return
    r.node.onaudioprocess = null
    r.node.disconnect()
    r.stream.getTracks().forEach((t) => t.stop())
    void r.ctx.close()
  }, [])

  useEffect(() => release, [release])

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
      const source = ctx.createMediaStreamSource(stream)
      const node = ctx.createScriptProcessor(4096, 1, 1)
      const chunks: Float32Array[] = []
      node.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))
      source.connect(node)
      node.connect(ctx.destination)
      rec.current = { stream, ctx, node, chunks }
      setState('recording')
      void loadTranscriber().catch(() => undefined)
    } catch {
      setError('Microphone unavailable')
      setState('idle')
    }
  }, [])

  const stop = useCallback(async () => {
    const r = rec.current
    if (!r) return
    const audio = joinChunks(r.chunks)
    release()
    if (audio.length < SAMPLE_RATE / 4) {
      setState('idle')
      return
    }
    try {
      setState('loading')
      const run = await loadTranscriber()
      setState('transcribing')
      const result = await run(audio)
      const text = (Array.isArray(result) ? result.map((x) => x.text).join(' ') : result.text).trim()
      if (text) onTextRef.current(text)
    } catch {
      setError('Speech model failed to load')
    }
    setState('idle')
  }, [release])

  const toggle = useCallback(() => {
    if (state === 'recording') void stop()
    else if (state === 'idle') void start()
  }, [state, start, stop])

  // Hold-to-talk: holdStart begins recording, holdEnd (key or button released, window blurred) stops and transcribes.
  // A release that lands while the microphone is still opening stops the recording as soon as it is ready.
  const held = useRef(false)
  const stateRef = useRef(state)
  stateRef.current = state
  const holdStart = useCallback(async () => {
    held.current = true
    if (stateRef.current !== 'idle' || rec.current) return
    await start()
    if (!held.current && rec.current) void stop()
  }, [start, stop])
  const holdEnd = useCallback(() => {
    if (!held.current) return
    held.current = false
    if (rec.current) void stop()
  }, [stop])

  return { state, error, toggle, holdStart, holdEnd }
}
