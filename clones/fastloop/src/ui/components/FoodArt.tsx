/**
 * Card art, generated rather than photographed.
 *
 * The apps in this category lean on food photography, which is not available
 * here and would not be ours to use. Instead each card gets a duotone field
 * with a drawn glyph: it reads as an image at thumbnail size, stays crisp at
 * any density, costs nothing to ship, and is the same in both themes because
 * it is a picture, not a surface.
 */

export type ArtKind =
  | 'bowl' | 'leaf' | 'fish' | 'egg' | 'soup' | 'grain' | 'meat' | 'berry' | 'nuts' | 'avocado'
  | 'sunrise' | 'protein' | 'coin' | 'clock' | 'sprout' | 'return';

const GRADIENTS: Record<ArtKind, readonly [string, string]> = {
  bowl: ['#0f766e', '#5eead4'],
  leaf: ['#166534', '#86efac'],
  fish: ['#0c4a6e', '#7dd3fc'],
  egg: ['#b45309', '#fcd34d'],
  soup: ['#c2410c', '#fdba74'],
  grain: ['#92400e', '#fbbf24'],
  meat: ['#9f1239', '#fda4af'],
  berry: ['#5b21b6', '#c4b5fd'],
  nuts: ['#78350f', '#e7d5bd'],
  avocado: ['#3f6212', '#bef264'],
  sunrise: ['#be123c', '#fdba74'],
  protein: ['#1e3a8a', '#93c5fd'],
  coin: ['#115e59', '#99f6e4'],
  clock: ['#3730a3', '#a5b4fc'],
  sprout: ['#14532d', '#a7f3d0'],
  return: ['#7c2d12', '#fdba74'],
};

/** Glyphs are drawn in a 48×48 box and scaled by the tile. */
function Glyph({ kind }: { kind: ArtKind }): JSX.Element {
  const stroke = { fill: 'none', stroke: 'rgba(255,255,255,0.95)', strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const solid = { fill: 'rgba(255,255,255,0.95)' };

  switch (kind) {
    case 'bowl':
      return <g {...stroke}><path d="M8 22h32c0 10-7 17-16 17S8 32 8 22z" /><path d="M16 16c0-3 3-4 3-7M24 14c0-3 3-4 3-7M32 16c0-3 3-4 3-7" /></g>;
    case 'leaf':
      return <g {...stroke}><path d="M10 38C8 24 18 10 38 10c2 18-10 28-24 28z" /><path d="M14 36c6-8 12-14 20-18" /></g>;
    case 'fish':
      return <g {...stroke}><path d="M6 24c6-9 16-13 24-13 6 0 10 5 12 13-2 8-6 13-12 13-8 0-18-4-24-13z" /><path d="M42 24l-6-6v12z" /><circle cx="17" cy="21" r="1.6" {...solid} /></g>;
    case 'egg':
      return <g {...stroke}><ellipse cx="24" cy="26" rx="14" ry="16" /><circle cx="24" cy="26" r="6" {...solid} /></g>;
    case 'soup':
      return <g {...stroke}><path d="M7 21h34c0 11-7 18-17 18S7 32 7 21z" /><path d="M4 21h40M18 13c0-3 2-4 2-6M28 13c0-3 2-4 2-6" /></g>;
    case 'grain':
      return <g {...stroke}><path d="M24 42V12" /><path d="M24 16c5-5 10-5 12-3-1 5-7 8-12 8zM24 26c5-5 10-5 12-3-1 5-7 8-12 8zM24 16c-5-5-10-5-12-3 1 5 7 8 12 8zM24 26c-5-5-10-5-12-3 1 5 7 8 12 8z" /></g>;
    case 'meat':
      return <g {...stroke}><path d="M12 30c-4-8 2-18 12-19 9-1 16 5 16 13 0 7-5 12-12 13-7 1-13-2-16-7z" /><path d="M20 20c3-2 7-2 10 1" /></g>;
    case 'berry':
      return <g {...stroke}><circle cx="18" cy="30" r="8" /><circle cx="31" cy="28" r="7" /><path d="M18 22c0-5 2-8 6-10M31 21c0-4 2-6 5-7" /></g>;
    case 'nuts':
      return <g {...stroke}><path d="M24 8c8 4 12 11 12 18 0 8-5 14-12 14s-12-6-12-14c0-7 4-14 12-18z" /><path d="M24 14v26M17 22h14M16 30h16" /></g>;
    case 'avocado':
      return <g {...stroke}><path d="M24 8c8 0 14 8 14 17 0 10-6 17-14 17s-14-7-14-17c0-9 6-17 14-17z" /><ellipse cx="24" cy="28" rx="6" ry="7" {...solid} /></g>;
    case 'sunrise':
      return <g {...stroke}><path d="M6 34h36" /><path d="M24 12v6M12 18l4 4M36 18l-4 4M4 26h6M38 26h6" /><path d="M14 34a10 10 0 0 1 20 0" /></g>;
    case 'protein':
      return <g {...stroke}><path d="M6 24h5M37 24h5" /><rect x="11" y="17" width="6" height="14" rx="2" /><rect x="31" y="17" width="6" height="14" rx="2" /><path d="M17 24h14" /></g>;
    case 'coin':
      return <g {...stroke}><circle cx="24" cy="24" r="14" /><path d="M24 15v18M20 19h6a3.5 3.5 0 0 1 0 7h-5a3.5 3.5 0 0 0 0 7h6" /></g>;
    case 'clock':
      return <g {...stroke}><circle cx="24" cy="25" r="15" /><path d="M24 16v9l6 4M19 6h10" /></g>;
    case 'sprout':
      return <g {...stroke}><path d="M24 42V22" /><path d="M24 24c-7 0-12-5-12-11 7 0 12 4 12 11zM24 22c6 0 11-4 11-10-6 0-11 4-11 10z" /></g>;
    case 'return':
      return <g {...stroke}><path d="M38 24a14 14 0 1 1-5-10.7" /><path d="M38 8v8h-8" /></g>;
    default:
      return <g />;
  }
}

export function ArtTile({
  kind,
  height = 120,
  rounded = 16,
  label,
  variant = 'tile',
}: {
  kind: ArtKind;
  height?: number;
  rounded?: number;
  label?: string;
  /** 'hero' shifts the glyph clear of the overlaid text and adds a scrim. */
  variant?: 'tile' | 'hero';
}): JSX.Element {
  const [from, to] = GRADIENTS[kind];
  const id = `art-${kind}`;
  const scrimId = `${id}-scrim`;
  const glyphX = variant === 'hero' ? 104 : 56;
  return (
    <svg
      viewBox="0 0 160 100"
      preserveAspectRatio="xMidYMid slice"
      style={{ width: '100%', height, display: 'block', borderRadius: rounded }}
      role="img"
      aria-label={label ?? ''}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
        {variant === 'hero' ? (
          <linearGradient id={scrimId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(0,0,0,0.5)" />
            <stop offset="62%" stopColor="rgba(0,0,0,0.12)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </linearGradient>
        ) : null}
      </defs>
      <rect width="160" height="100" fill={`url(#${id})`} />
      <circle cx="132" cy="18" r="34" fill="rgba(255,255,255,0.12)" />
      <circle cx="20" cy="88" r="26" fill="rgba(0,0,0,0.08)" />
      <g transform={`translate(${glyphX} 26) scale(0.96)`}>
        <Glyph kind={kind} />
      </g>
      {variant === 'hero' ? <rect width="160" height="100" fill={`url(#${scrimId})`} /> : null}
    </svg>
  );
}
