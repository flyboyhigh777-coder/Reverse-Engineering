import { anthropic } from './anthropic';
import { google } from './google';
import type { ProviderId, VisionProvider } from './contract';

export type { Guess, KeyCheck, ProviderId, ShotContext, VisionProvider, VisionResult } from './contract';
export { VISION_NOTE, scaleGuess } from './contract';

/**
 * Who can read a plate, free one first.
 *
 * Order is the answer to the question people actually ask — "what do I have
 * to do to turn this on" — so the provider that needs nothing but a Google
 * account comes before the one that needs a card.
 */
export const VISION_PROVIDERS: readonly VisionProvider[] = [google, anthropic];

export const DEFAULT_PROVIDER: ProviderId = 'google';

export function providerById(id: string | null | undefined): VisionProvider {
  return VISION_PROVIDERS.find((provider) => provider.id === id) ?? google;
}
