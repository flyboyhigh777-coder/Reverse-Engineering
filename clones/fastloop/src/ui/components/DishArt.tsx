import { useEffect, useState } from 'react';
import { ArtTile } from './FoodArt';
import type { ArtKind } from './FoodArt';
import { useDishPhoto } from '../../state/photos';

/**
 * A recipe card's picture.
 *
 * The drawn art stays underneath and is what renders first; a photograph is
 * laid over it once one has been found, and goes away again if the file
 * moved. So the card is never empty, never waits on the network, and never
 * shows a broken image — the picture simply gets better when it can.
 */
export function DishArt({
  id,
  kind,
  height = 120,
  rounded = 16,
  label,
  variant = 'tile',
  credit = true,
}: {
  /** Recipe id, or null for art that has no dish behind it. */
  id: string | null;
  kind: ArtKind;
  height?: number;
  rounded?: number;
  label?: string;
  variant?: 'tile' | 'hero';
  /** Thumbnails are too small to carry the credit; their card shows it instead. */
  credit?: boolean;
}): JSX.Element {
  const photo = useDishPhoto(id);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [photo?.url]);

  const show = photo !== null && !broken;
  return (
    <div className="art" style={{ height, borderRadius: rounded }}>
      <ArtTile kind={kind} height={height} rounded={rounded} label={label} variant={variant} />
      {show ? (
        <img
          src={photo.url}
          alt={label ?? ''}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : null}
      {show && credit ? <span className="credit">{photo.author} · {photo.license}</span> : null}
      {show && variant === 'hero' ? <span className="scrim" /> : null}
    </div>
  );
}
