import { useCallback, useEffect, useRef, useState } from 'react'
import type { DecodeRequest, DecodeResponse } from './decoder.worker'
import { PresentationGate } from './gate'

export type CameraStatus =
  | 'starting'
  | 'ready'
  | 'denied' // the browser or OS blocked camera access
  | 'missing' // no camera found
  | 'busy' // another app holds the camera
  | 'error'

export interface Scanner {
  status: CameraStatus
  devices: MediaDeviceInfo[]
  deviceId: string | undefined
  setDeviceId: (id: string) => void
  retry: () => void
  /** Several codes are in view, so none is acted on. */
  multiple: boolean
}

const DECODE_INTERVAL_MS = 110
const MAX_DECODE_WIDTH = 960
const DEVICE_KEY = 'item-tracker:camera'

function readStoredDevice(): string | undefined {
  try {
    return localStorage.getItem(DEVICE_KEY) ?? undefined
  } catch {
    return undefined
  }
}

function classify(err: unknown): CameraStatus {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'missing'
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy'
  return 'error'
}

/**
 * Runs the camera into `videoRef` and calls `onCode` once per deliberate
 * presentation of a QR code. Decoding happens in a worker so the UI never stalls.
 */
export function useScanner(videoRef: React.RefObject<HTMLVideoElement | null>, onCode: (code: string) => void): Scanner {
  const [status, setStatus] = useState<CameraStatus>('starting')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceIdState] = useState<string | undefined>(readStoredDevice)
  const [multiple, setMultiple] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const onCodeRef = useRef(onCode)
  useEffect(() => {
    onCodeRef.current = onCode
  }, [onCode])

  const setDeviceId = useCallback((id: string) => {
    try {
      localStorage.setItem(DEVICE_KEY, id)
    } catch {
      // Remembering the camera is a convenience; ignore storage failures.
    }
    setStatus('starting')
    setDeviceIdState(id)
  }, [])

  const retry = useCallback(() => {
    setStatus('starting')
    setAttempt((n) => n + 1)
  }, [])

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('missing')
        return
      }
      const video: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 } }
      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: deviceId ? { ...video, deviceId: { exact: deviceId } } : video,
            audio: false,
          })
        } catch (err) {
          // A remembered camera may have been unplugged: fall back to any camera.
          if (!deviceId || classify(err) !== 'missing') throw err
          stream = await navigator.mediaDevices.getUserMedia({ video, audio: false })
        }
        if (cancelled) return
        const el = videoRef.current
        if (el) {
          el.srcObject = stream
          await el.play().catch(() => {})
        }
        setDevices((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput'))
        setStatus('ready')
        stream.getVideoTracks()[0]?.addEventListener('ended', () => !cancelled && setStatus('missing'))
      } catch (err) {
        if (!cancelled) setStatus(classify(err))
      }
    }
    start()
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [deviceId, attempt, videoRef])

  useEffect(() => {
    if (status !== 'ready') return
    const worker = new Worker(new URL('./decoder.worker.ts', import.meta.url), { type: 'module' })
    const gate = new PresentationGate()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    let busy = false
    let nextId = 0

    worker.onmessage = (event: MessageEvent<DecodeResponse>) => {
      busy = false
      const { codes } = event.data
      setMultiple(codes.length > 1)
      const code = gate.observe(codes, performance.now())
      if (code) onCodeRef.current(code)
    }

    const timer = window.setInterval(() => {
      const video = videoRef.current
      if (busy || !ctx || !video || document.hidden || video.readyState < 2 || !video.videoWidth) return
      const scale = Math.min(1, MAX_DECODE_WIDTH / video.videoWidth)
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
      busy = true
      worker.postMessage({ id: nextId++, image } satisfies DecodeRequest, [image.data.buffer])
    }, DECODE_INTERVAL_MS)

    return () => {
      window.clearInterval(timer)
      worker.terminate()
    }
  }, [status, videoRef])

  return { status, devices, deviceId, setDeviceId, retry, multiple }
}
