/// <reference lib="webworker" />
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

// Serve the decoder from the app itself; the desk must work without internet.
prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
  },
})

export interface DecodeRequest {
  id: number
  image: ImageData
}

export interface DecodeResponse {
  id: number
  codes: string[]
  /** QR-like shapes found but not readable, so the UI can say "hold still". */
  unreadable: number
  error?: string
}

self.onmessage = async (event: MessageEvent<DecodeRequest>) => {
  const { id, image } = event.data
  try {
    const results = await readBarcodes(image, {
      formats: ['QRCode'],
      tryHarder: true,
      tryInvert: false,
      maxNumberOfSymbols: 4,
      returnErrors: true,
    })
    const codes = results.filter((r) => r.isValid && r.text).map((r) => r.text)
    const response: DecodeResponse = { id, codes, unreadable: results.length - codes.length }
    self.postMessage(response)
  } catch (err) {
    self.postMessage({ id, codes: [], unreadable: 0, error: String(err) } satisfies DecodeResponse)
  }
}
