import type { Item } from '../lib/survival';

/** Small original pixel sprites; kept as vectors so inventory assets stay crisp and local. */
export function ItemIcon({
  item,
  size = 32,
}: {
  item: Item | 'axe' | 'pickaxe' | 'backpack';
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="item-icon"
    >
      {item === 'wood' && (
        <>
          <path fill="#7b573a" d="M4 9h3V6h14v6h-3v6H4z" />
          <path fill="#b58a51" d="M5 10h13v5H5zM8 7h11v3H8z" />
          <path fill="#e1bc7b" d="M4 10h4v6H4zM18 7h3v5h-3z" />
          <path fill="#785034" d="M5 11h2v3H5z" />
        </>
      )}
      {(item === 'stone' || item === 'ore') && (
        <>
          <path fill="#64756d" d="M3 10h3V6h11v3h4v10H3z" />
          <path fill="#a4b1a1" d="M6 7h9v3H6zM4 11h11v4H4z" />
          <path fill="#4d6159" d="M16 11h4v7h-4z" />
          {item === 'ore' && <path fill="#d59c5d" d="M7 10h4v4H7zM13 15h4v3h-4z" />}
        </>
      )}
      {(item === 'fiber' || item === 'herb') && (
        <>
          <path fill="#52754c" d="M6 6h3v14H6zM11 3h3v17h-3zM16 8h3v12h-3zM3 10h3v6H3z" />
          <path fill="#86a16b" d="M7 4h3v7H7zM12 2h3v7h-3zM17 5h3v7h-3z" />
          {item === 'herb' && <path fill="#ad8eb6" d="M5 4h6v4H5zM11 2h6v4h-6zM16 6h6v4h-6z" />}
          <path fill="#c4a169" d="M5 15h15v3H5z" />
        </>
      )}
      {item === 'berry' && (
        <>
          <path fill="#537e4d" d="M9 3h8v3h-8zM12 3h3v10h-3z" />
          <path fill="#a8424b" d="M5 8h7v3h3V8h5v10h-3v3H7v-3H4V11h1z" />
          <path fill="#dd7d72" d="M6 10h3v3H6zM16 10h3v3h-3zM9 16h3v3H9z" />
        </>
      )}
      {(item === 'seed' || item === 'mix') && (
        <>
          <path fill="#8d693a" d="M7 4h10v3h3v10h-3v4H7v-4H4V7h3z" />
          <path fill="#e0bc72" d="M8 5h8v3h2v9h-3v3H8v-4H6V8h2z" />
          <path fill="#9b7c48" d="M11 7h3v10h-3z" />
          {item === 'mix' && <path fill="#a8424b" d="M3 15h6v6H3zM15 3h5v5h-5z" />}
        </>
      )}
      {item === 'plank' && (
        <>
          <path fill="#765336" d="M3 4h18v6H3zM3 13h18v7H3z" />
          <path fill="#b58b52" d="M4 5h16v3H4zM4 14h16v4H4z" />
          <path fill="#d3ac68" d="M6 5h2v3H6zM16 14h2v4h-2z" />
        </>
      )}
      {item === 'bandage' && (
        <>
          <path fill="#b8ae90" d="M7 2h10v20H7zM2 7h20v10H2z" />
          <path fill="#ece1bd" d="M8 3h8v18H8zM3 8h18v8H3z" />
          <path fill="#b98565" d="M9 9h6v6H9z" />
        </>
      )}
      {(item === 'axe' || item === 'pickaxe') && (
        <>
          <path fill="#775537" d="M7 20h4V8H7zM10 7h4V4h-4z" />
          <path
            fill="#728c84"
            d={item === 'axe' ? 'M10 3h10v4h2v6H12V9h-2z' : 'M4 4h15v3h3v5h-4V8H4z'}
          />
          <path fill="#bdd0bb" d="M11 3h8v3h-8z" />
        </>
      )}
      {item === 'backpack' && (
        <>
          <path fill="#6b714b" d="M7 3h10v3h4v15H3V6h4z" />
          <path fill="#a4a16c" d="M5 7h14v12H5z" />
          <path fill="#7b8350" d="M7 12h10v6H7z" />
          <path fill="#d6c48c" d="M10 8h4v6h-4z" />
        </>
      )}
    </svg>
  );
}
