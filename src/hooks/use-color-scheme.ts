import { useColorScheme as useSystemScheme } from 'react-native';

import { useAppearance } from '@/lib/appearance';

/** 'light' or 'dark': the mode chosen in Settings, or the phone's own. */
export function useColorScheme(): 'light' | 'dark' {
  const system = useSystemScheme();
  const { mode } = useAppearance();
  if (mode !== 'system') return mode;
  return system === 'dark' ? 'dark' : 'light';
}
