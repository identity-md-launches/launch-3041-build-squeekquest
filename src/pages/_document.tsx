import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="./favicon.svg" type="image/svg+xml" />
        <link rel="stylesheet" href="./fonts/nunito.css" />
        <meta
          name="description"
          content="Explore the forest, gather supplies, craft tools and build a cozy burrow in SqueekQuest, a little hamster survival adventure."
        />
        <meta property="og:title" content="SqueekQuest | Small paws. Wild world." />
        <meta
          property="og:description"
          content="A hamster survival adventure. Explore three wild places, craft your tools and make yourself at home."
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
