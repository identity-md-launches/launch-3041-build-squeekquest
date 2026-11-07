import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="./favicon.svg" type="image/svg+xml" />
        <link rel="stylesheet" href="./fonts/nunito.css" />
        <meta
          name="description"
          content="Explore, fight, craft and build a burrow in SqueekQuest, a pixel-art hamster survival adventure powered by confirmed Squeekchain data."
        />
        <meta property="og:title" content="SqueekQuest | Small paws. Wild world." />
        <meta
          property="og:description"
          content="Four wild places, one brave hamster. Fight the Root Warden, build your burrow and discover real Squeekchain-powered world events."
        />
        <meta property="og:image" content="./survival-card.png" />
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
