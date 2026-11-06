import type { CSSProperties } from 'react';

const paths: Record<string, string> = {
  bolt: 'm13 2-9 12h7l-1 8 10-12h-7Z',
  heart:
    'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  bag: 'M6 7h12l3 14H3Zm3 0V5a3 3 0 0 1 6 0v2M8 12h8v5H8Z',
  hammer: 'm4 21 10-10m-4-7 4-3 8 8-3 4-3-3-3 3-5-5Z',
  fire: 'M12 2c4 6-2 7 3 11 2-1 3-3 3-5 7 10 0 14-6 14S1 15 5 9c0 4 4 6 4 2 0-2 1-6 3-9Z',
  chest: 'M3 10h18v11H3Zm0 0V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v4M10 9h4v6h-4Z',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  chevron: 'm9 5 7 7-7 7',
  close: 'm6 6 12 12M6 18 18 6',
  check: 'm5 12 4 4L19 6',
  plus: 'M12 5v14M5 12h14',
  play: 'm9 5 10 7-10 7Z',
  pause: 'M8 5v14M16 5v14',
  sun: 'M12 3v1m0 16v1M3 12h1m16 0h1M5.6 5.6l.7.7m11.4 11.4.7.7M5.6 18.4l.7-.7M17.7 6.3l.7-.7M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  moon: 'M20 14a8.5 8.5 0 0 1-10-10 8.5 8.5 0 1 0 10 10Z',
  sound: 'm11 5-6 4H2v6h3l6 4Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  mute: 'm11 5-6 4H2v6h3l6 4Zm5 4 6 6m0-6-6 6',
  help: 'M9 9a3 3 0 1 1 5 2.2c-1.1.6-2 1-2 2.8m0 3h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  seed: 'M6 18C-1 9 9 1 19 4c3 10-5 21-13 14Zm0 0L17 6m-5 7 1-5m-5 9 5-1',
  leaf: 'M4 20C-1 4 10 3 21 3c0 12-5 20-17 17Zm0 0L16 8',
  cube: 'm12 3 9 5v9l-9 5-9-5V8Zm0 9 9-4m-9 4L3 8m9 4v10M7 5.8l9.5 5.3',
  compass: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Zm-6-4-3 7-5 1 3-7Z',
  star: 'm12 3 2.8 5.7 6.3.9-4.6 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z',
  trophy: 'M8 3h8v8a4 4 0 0 1-8 0ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 3v5m-4 1h8',
  radio:
    'M12 13v8m-4 0h8M12 8h.01M8.5 4.5a5 5 0 0 0 0 7m7-7a5 5 0 0 1 0 7M5 1a10 10 0 0 0 0 14M19 1a10 10 0 0 1 0 14',
  wheel:
    'M21 11a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 2v18M3 11h18M6 5l12 12M6 17 18 5M9 20l-2 2m8-2 2 2',
  clock: 'M12 7v5l3 2m7-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  refresh: 'M20 7v5h-5M4 17v-5h5M4.5 8a8 8 0 0 1 13-4L20 7M4 17l2.5 3a8 8 0 0 0 13-4',
  external: 'M14 3h7v7m0-7L10 14m0-11H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5',
  search: 'M21 21l-5-5m2-6a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  shield: 'm12 2 8 4v7c0 5-8 9-8 9s-8-4-8-9V6Zm-4 10 3 3 5-6',
  book: 'M12 5C9 2 3 3 2 4v16c4-2 7-1 10 1m0-16c3-3 9-2 10-1v16c-4-2-7-1-10 1Zm0 0v16',
  up: 'm6 14 6-6 6 6',
  down: 'm6 10 6 6 6-6',
  left: 'm14 6-6 6 6 6',
  right: 'm10 6 6 6-6 6',
  home: 'm3 10 9-7 9 7v11h-6v-7H9v7H3Z',
  flag: 'M5 21V3m0 1c5-4 9 4 15 0v10c-6 4-10-4-15 0',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  edit: 'm16 3 5 5-12 12-6 1 1-6Zm-2 2 5 5',
};
export function Icon({
  name,
  size = 20,
  className = '',
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={`icon ${className}`}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.star} />
    </svg>
  );
}
export function Hamster({
  className = '',
  style,
  face = false,
}: {
  className?: string;
  style?: CSSProperties;
  face?: boolean;
}) {
  return (
    <svg viewBox="0 0 120 130" className={className} style={style} fill="none" aria-hidden="true">
      {!face && <ellipse cx="60" cy="119" rx="34" ry="7" fill="#304d34" opacity=".13" />}
      <ellipse cx="34" cy="34" rx="16" ry="20" fill="#be7953" stroke="#714b37" strokeWidth="3" />
      <ellipse cx="87" cy="34" rx="16" ry="20" fill="#be7953" stroke="#714b37" strokeWidth="3" />
      <ellipse cx="34" cy="34" rx="9" ry="13" fill="#e9aa98" />
      <ellipse cx="87" cy="34" rx="9" ry="13" fill="#e9aa98" />
      <path
        d="M17 77C17 45 32 28 60 28s44 17 44 49c0 27-17 42-44 42S17 104 17 77Z"
        fill="#d89862"
        stroke="#714b37"
        strokeWidth="3"
      />
      <path
        d="M37 76c0-13 10-17 23-17s23 4 23 17c17 1 17 26 2 33-16 7-36 7-50 0-16-8-15-32 2-33Z"
        fill="#fff2da"
      />
      <ellipse cx="36" cy="80" rx="10" ry="7" fill="#f0a38c" opacity=".6" />
      <ellipse cx="85" cy="80" rx="10" ry="7" fill="#f0a38c" opacity=".6" />
      <ellipse cx="41" cy="65" rx="4.5" ry="6" fill="#3a3528" />
      <ellipse cx="80" cy="65" rx="4.5" ry="6" fill="#3a3528" />
      <circle cx="42" cy="63" r="1.5" fill="white" />
      <circle cx="81" cy="63" r="1.5" fill="white" />
      <path d="M55 79q5-5 10 0l-5 5Z" fill="#aa6d62" />
      <path d="M60 84v5m-7-2q7 8 14 0" stroke="#714b37" strokeWidth="2.5" strokeLinecap="round" />
      {!face && (
        <>
          <path d="m24 96 10 5m61-5-9 5" stroke="#714b37" strokeWidth="3" strokeLinecap="round" />
          <path
            d="M39 116q-6 8-14 3m56-3q6 8 14 3"
            fill="#d89862"
            stroke="#714b37"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="m45 31 13-14 15 15" fill="#608a57" stroke="#3a663b" strokeWidth="2" />
          <path d="m61 21 20 1-13 9" fill="#80a761" />
          <path d="M15 57 28 53l-2 8" fill="#80a761" />
        </>
      )}
    </svg>
  );
}
