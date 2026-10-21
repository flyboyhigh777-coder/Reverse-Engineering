/**
 * One glyph per kind of claim a fasting window makes.
 *
 * Drawn rather than imported: an icon font would be another download for
 * thirteen shapes, and these have to read at 21px inside a coloured chip.
 */

import type { BenefitIcon } from '../../domain/planDetail';

const P = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function PlanIcon({ kind }: { kind: BenefitIcon }): JSX.Element {
  switch (kind) {
    case 'fat':
      return <svg {...P}><path d="M12 3c3.5 3.6 5.5 6.3 5.5 9.2a5.5 5.5 0 0 1-11 0C6.5 9.3 8.5 6.6 12 3z" /><path d="M12 19.5a2.6 2.6 0 0 1-2.6-2.6c0-1.4 1-2.3 2.6-4 1.6 1.7 2.6 2.6 2.6 4a2.6 2.6 0 0 1-2.6 2.6z" /></svg>;
    case 'insulin':
      return <svg {...P}><path d="M3 15c2.2 0 2.6-7 5-7s2.6 9 5 9 2.6-5 5-5" /><circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none" /></svg>;
    case 'brain':
      return <svg {...P}><path d="M12 5.2a3 3 0 0 0-5.6 1.3A2.8 2.8 0 0 0 4.6 9c0 1 .5 1.8 1.2 2.3-.5.5-.8 1.2-.8 2 0 1.6 1.4 2.9 3.1 2.9.5 1.1 1.6 1.8 2.9 1.8.6 0 1-.1 1-.1V5.2z" /><path d="M12 5.2a3 3 0 0 1 5.6 1.3A2.8 2.8 0 0 1 19.4 9c0 1-.5 1.8-1.2 2.3.5.5.8 1.2.8 2 0 1.6-1.4 2.9-3.1 2.9-.5 1.1-1.6 1.8-2.9 1.8-.6 0-1-.1-1-.1" /></svg>;
    case 'gut':
      return <svg {...P}><path d="M7 3v4.5c0 2 2.6 2 2.6 4S7 13.5 7 15.5V21" /><path d="M13 3v3.5c0 2.2 4 2 4 4.5s-4 2.4-4 4.6V21" /></svg>;
    case 'heart':
      return <svg {...P}><path d="M12 20s-7-4.4-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.6 12 20 12 20z" /></svg>;
    case 'sleep':
      return <svg {...P}><path d="M20 13.5A7.6 7.6 0 0 1 10.5 4 7.8 7.8 0 1 0 20 13.5z" /><path d="M14.5 3h3.5l-3.5 4h3.5" /></svg>;
    case 'energy':
      return <svg {...P}><path d="M13.5 2.5 5.5 13h5l-1 8.5L18.5 11h-5l1-8.5z" /></svg>;
    case 'autophagy':
      return <svg {...P}><circle cx="12" cy="12" r="8.5" /><path d="M9 10.3a3.6 3.6 0 0 1 5.8-.9l1.1 1.1" /><path d="M15 13.7a3.6 3.6 0 0 1-5.8.9L8.1 13.5" /><path d="M16.3 8v2.6h-2.6M7.7 16v-2.6h2.6" /></svg>;
    case 'muscle':
      return <svg {...P}><path d="M3 10v4M21 10v4M6.5 8v8M17.5 8v8" /><path d="M6.5 12h11" /></svg>;
    case 'simple':
      return <svg {...P}><circle cx="12" cy="12" r="8.5" /><path d="M8.3 12.2l2.6 2.6 4.8-5.3" /></svg>;
    case 'weight':
      // Bathroom scale: a gauge with a needle, not an arrow in a box.
      return <svg {...P}><rect x="3.5" y="4.5" width="17" height="15" rx="3.5" /><path d="M8 15.4a4 4 0 0 1 8 0" /><path d="M12 15.4 14.2 10.8" /></svg>;
    case 'inflammation':
      return <svg {...P}><path d="M12 3.2 19 6v6c0 4.2-3 7-7 8.8C8 19 5 16.2 5 12V6l7-2.8z" /><path d="M12 9v3.6M12 15.4v.2" /></svg>;
    case 'habit':
    default:
      return <svg {...P}><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 9.6h17M8 3.2v3.4M16 3.2v3.4" /><path d="M9 14.4l2 2 4-4.2" /></svg>;
  }
}
