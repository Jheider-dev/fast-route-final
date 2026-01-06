import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import Head from 'next/head'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Fast Route | UNA Puno</title>
        <meta name="description" content="Sistema de Transporte Universitario Inteligente" />
        <link rel="icon" href="/logo_fast_route.png" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}