import type { AppProps } from 'next/app';
import '../styles/globals.css';
import '../styles/survival.css';
import '../styles/web3.css';

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
