import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="./favicon.svg" type="image/svg+xml" />
        <link rel="stylesheet" href="./fonts/nunito.css" />
        <meta
          name="description"
          content="Explore a little hamster world, complete quests with real SqueekChain Sepolia events, and discover the chain one paw at a time."
        />
        <meta property="og:title" content="SqueekQuest | Small paws. Big discoveries." />
        <meta
          property="og:description"
          content="A playable hamster adventure powered by real SqueekChain data. Explore, collect, and discover."
        />
        <meta property="og:image" content="./social-card.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="theme-color" content="#f7f8f2" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
