import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { SessionProvider } from 'next-auth/react'
import { AlertProvider } from '../components/ModalAlert'

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <AlertProvider>
        <Component {...pageProps} />
      </AlertProvider>
    </SessionProvider>
  )
}