import { writeFileSync } from 'node:fs'
import QRCode from 'qrcode'

/** The value the fake camera keeps showing. */
export const cameraCode = 'itemtracker:e2e-camera'

/**
 * Writes a looping Y4M video for Chromium's fake camera: `blankSeconds` of an
 * empty frame, then `codeSeconds` showing a QR code, like a volunteer holding
 * a card up and taking it away again.
 */
export function writeFakeCamera(path: string, code: string, blankSeconds = 2, codeSeconds = 3) {
  const width = 320
  const height = 240
  const fps = 10
  const qr = QRCode.create(code, { errorCorrectionLevel: 'M' })
  const size = qr.modules.size
  const scale = Math.floor(200 / (size + 8))
  const side = (size + 8) * scale
  const left = Math.floor((width - side) / 2)
  const top = Math.floor((height - side) / 2)

  const blank = Buffer.alloc(width * height, 0xd0) // light grey desk surface
  const withCode = Buffer.from(blank)
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const mx = Math.floor(x / scale) - 4
      const my = Math.floor(y / scale) - 4
      const dark = mx >= 0 && my >= 0 && mx < size && my < size && qr.modules.get(my, mx) === 1
      withCode[(top + y) * width + left + x] = dark ? 0x10 : 0xff
    }
  }
  const chroma = Buffer.alloc((width / 2) * (height / 2) * 2, 128)
  const frames: Buffer[] = [Buffer.from(`YUV4MPEG2 W${width} H${height} F${fps}:1 Ip A1:1 C420jpeg\n`)]
  const push = (luma: Buffer, count: number) => {
    for (let i = 0; i < count; i++) frames.push(Buffer.from('FRAME\n'), luma, chroma)
  }
  push(blank, blankSeconds * fps)
  push(withCode, codeSeconds * fps)
  writeFileSync(path, Buffer.concat(frames))
}
