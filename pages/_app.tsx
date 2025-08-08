// pages/_app.tsx
import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { SessionProvider } from 'next-auth/react'
import { useEffect } from 'react'

// ⬇️ point to the real file
import { AlertProvider } from '../components/ModalAlert'

import { useWebSocket } from '../hooks/useWebSocket';

import { addGlobalErrorHandler, debugWebSocketConnection } from '../lib/debug-utils'

function WebSocketBootstrap() {
  useWebSocket()
  
  // Initialize debugging utilities
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
