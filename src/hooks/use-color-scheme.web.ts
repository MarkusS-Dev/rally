import { useSyncExternalStore } from 'react';
import { useColorScheme as useSystemScheme } from 'react-native';

import { useAppearance } from '@/lib/appearance';

const subscribe = () => () => {};

/**
 * The mode chosen in Settings, or the browser's own. Renders 'light' until
 * hydrated, since a pre-rendered page can't know the visitor's preference.
 */
export function useColorScheme(): 'light' | 'dark' {
  const hasHydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const system = useSystemScheme();
  const { mode } = useAppearance();
  if (!hasHydrated) return 'light';
  if (mode !== 'system') return mode;
  return system === 'dark' ? 'dark' : 'light';
}
