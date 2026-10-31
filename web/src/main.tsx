import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient()

// The GitHub Pages build answers the API in the browser; the real build never
// includes the demo code.
const DemoBar = import.meta.env.VITE_DEMO ? (await import('./demo/DemoBar')).DemoBar : null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {DemoBar && <DemoBar />}
    </QueryClientProvider>
  </StrictMode>,
)
