import type { Theme } from '../themes/themes';

export type SurfaceMode = 'on' | 'off';

export const DEFAULT_SURFACE: SurfaceMode = 'on';

/**
 * BDUI_SURFACE decides whether the header, footer and detail panel sit on a
 * painted surface. Only the 256-colour themes own a surface colour; at 16
 * colours and below the terminal keeps its background whatever the switch says.
 */
export function resolveSurface(
  env: Record<string, string | undefined> = process.env,
): SurfaceMode {
  const requested = env.BDUI_SURFACE?.trim().toLowerCase();
  if (requested === 'off' || requested === '0' || requested === 'false' || requested === 'no') {
    return 'off';
  }
  return DEFAULT_SURFACE;
}

/** The background a chrome row paints with, or none when the axis or theme has none. */
export function surfaceOf(theme: Theme, mode: SurfaceMode): string | undefined {
  if (mode !== 'on') return undefined;
  return theme.colors.surface || undefined;
}
