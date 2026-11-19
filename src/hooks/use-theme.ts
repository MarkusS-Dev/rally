/**
 * The app's colours: light/dark mode plus the palette chosen in Settings.
 */

import { useMemo } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { buildTheme, paletteOf, useAppearance } from '@/lib/appearance';

export function useTheme() {
  const scheme = useColorScheme();
  const appearance = useAppearance();
  return useMemo(() => buildTheme(scheme, paletteOf(appearance)), [scheme, appearance]);
}
