// Light/dark mode and colour palette. Stored on this phone only.

import 'expo-sqlite/localStorage/install';
import { useSyncExternalStore } from 'react';
import { Appearance as RNAppearance, Platform } from 'react-native';

import { Colors, type ThemeColor } from '@/constants/colors';
import { contrast, ensureContrast, mix, readableOn } from '@/lib/color';

export type Mode = 'system' | 'light' | 'dark';

/** main: buttons, links, switches, your line. secondary: cards. tertiary: selections. */
export type Palette = { main: string; secondary: string; tertiary: string };

export const PRESETS: { id: string; name: string; palette: Palette }[] = [
  { id: 'rally', name: 'Rally', palette: { main: '#E4572E', secondary: '#8B8D98', tertiary: '#8B8D98' } },
  { id: 'ocean', name: 'Ocean', palette: { main: '#1E88E5', secondary: '#00ACC1', tertiary: '#5C6BC0' } },
  { id: 'forest', name: 'Forest', palette: { main: '#2E7D32', secondary: '#8D6E63', tertiary: '#9CCC65' } },
  { id: 'grape', name: 'Grape', palette: { main: '#8E24AA', secondary: '#5E35B1', tertiary: '#EC407A' } },
  { id: 'sunset', name: 'Sunset', palette: { main: '#F4511E', secondary: '#FFB300', tertiary: '#D81B60' } },
  { id: 'mono', name: 'Mono', palette: { main: '#52525B', secondary: '#71717A', tertiary: '#A1A1AA' } },
];

export type AppearanceState = {
  mode: Mode;
  /** A preset id, or 'custom'. */
  paletteId: string;
  /** Kept even while a preset is selected, so switching back restores it. */
  custom: Palette | null;
};

const STORAGE_KEY = 'rally.appearance';
const DEFAULT: AppearanceState = { mode: 'system', paletteId: 'rally', custom: null };

function load(): AppearanceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT, ...(JSON.parse(raw) as Partial<AppearanceState>) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

let state: AppearanceState = load();
const listeners = new Set<() => void>();

function applyNativeMode(mode: Mode) {
  // Lets native bits (switches, keyboard, status bar) follow the chosen mode.
  if (Platform.OS === 'web') return;
  try {
    RNAppearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
  } catch {
    // Older React Native: only our own colours follow the setting.
  }
}
applyNativeMode(state.mode);

export function getAppearance(): AppearanceState {
  return state;
}

export function setAppearance(patch: Partial<AppearanceState>) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Not persisted; still applies for this session.
  }
  if (patch.mode) applyNativeMode(patch.mode);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppearance(): AppearanceState {
  return useSyncExternalStore(subscribe, getAppearance, getAppearance);
}

export function paletteOf(a: AppearanceState): Palette {
  if (a.paletteId === 'custom' && a.custom) return a.custom;
  return (PRESETS.find((p) => p.id === a.paletteId) ?? PRESETS[0]).palette;
}

export type ThemeColors = Record<ThemeColor, string>;

/**
 * The app's colours for a mode and palette. The main colour is used as is
 * (nudged lighter/darker if it would vanish against the background);
 * secondary and tertiary are blended into the neutral surfaces so text
 * stays readable whatever is picked.
 */
export function buildTheme(scheme: 'light' | 'dark', p: Palette): ThemeColors {
  const base = Colors[scheme];
  const dark = scheme === 'dark';
  const accent = ensureContrast(p.main, base.background, 3);
  return {
    ...base,
    accent,
    onAccent: readableOn(accent),
    // Switch knobs: the raw tertiary colour, nudged so it shows on the main-coloured track.
    tertiary: ensureContrast(p.tertiary, accent, 1.5),
    backgroundElement: tint(base.backgroundElement, p.secondary, dark ? 0.18 : 0.12, base.text),
    border: mix(base.border, p.secondary, dark ? 0.22 : 0.18),
    backgroundSelected: tint(base.backgroundSelected, p.tertiary, dark ? 0.38 : 0.3, base.text),
  };
}

/** Blend `color` into a surface, backing off until `text` on it is still easy to read. */
function tint(surface: string, color: string, strength: number, text: string): string {
  for (let t = strength; t > 0; t -= 0.02) {
    const c = mix(surface, color, t);
    if (contrast(text, c) >= 7) return c;
  }
  return surface;
}
