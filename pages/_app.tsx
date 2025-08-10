// pages/_app.tsx
import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { SessionProvider } from 'next-auth/react'
import { useEffect, useRef } from 'react'

// ⬇️ point to the real file
import { AlertProvider } from '../components/ModalAlert'
import { useWebSocket } from '../hooks/useWebSocket'
import { addGlobalErrorHandler, debugWebSocketConnection } from '../lib/debug-utils'

function WebSocketBootstrap() {
  const wokeRef = useRef(false)

  // 🔌 Wake the Socket.IO server exactly once on mount
  useEffect(() => {
    if (wokeRef.current) return
    wokeRef.current = true
    fetch('/api/socket').catch(() => {})
  }, [])

  // 🎧 Connect + join room + set up listeners
  useWebSocket()

  // 🛠️ Debug hooks
  useEffect(() => {
    addGlobalErrorHandler()
    debugWebSocketConnection()
  }, [])

  return null
}

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <AlertProvider>
        <WebSocketBootstrap />
        <Component {...pageProps} />
      </AlertProvider>
    </SessionProvider>
  )
}