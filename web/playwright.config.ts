import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { defineConfig } from '@playwright/test'
import { cameraCode, writeFakeCamera } from './e2e/fake-camera'

// The end-to-end suite runs the real server binary against a throwaway database.
// Build it first: `npm run build` here, then `go build -o bin/itemtracker ./cmd/itemtracker` at the root.
const port = 4299
const scratch = mkdtempSync(join(tmpdir(), 'item-tracker-e2e-'))
const video = join(scratch, 'camera.y4m')
writeFakeCamera(video, cameraCode)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1440, height: 900 },
    permissions: ['camera'],
    trace: 'retain-on-failure',
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`],
    },
  },
  webServer: {
    command: process.env.ITEMTRACKER_BIN ?? resolve(import.meta.dirname, '../bin/itemtracker'),
    url: `http://localhost:${port}/api/health`,
    env: { ITEMTRACKER_ADDR: `127.0.0.1:${port}`, ITEMTRACKER_DATA: join(scratch, 'data') },
    reuseExistingServer: false,
    stdout: 'pipe',
  },
})
