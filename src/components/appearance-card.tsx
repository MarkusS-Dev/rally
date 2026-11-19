// Settings card: light/dark mode, a palette preset, or a custom palette.
// Changes apply straight away and are stored on this phone.

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ColorPickerModal } from '@/components/color-wheel';
import { ThemedText } from '@/components/themed-text';
import { Card, Segmented } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { paletteOf, PRESETS, setAppearance, useAppearance, type Mode, type Palette } from '@/lib/appearance';

const ROLES: { key: keyof Palette; label: string }[] = [
  { key: 'main', label: 'Main' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'tertiary', label: 'Tertiary' },
];

export function AppearanceCard() {
  const appearance = useAppearance();
  const current = paletteOf(appearance);
  const [editing, setEditing] = useState<keyof Palette | null>(null);
  const isCustom = appearance.paletteId === 'custom';
  const custom = appearance.custom ?? current;

  function chooseCustom() {
    // First time: start from whatever palette is showing now.
    setAppearance({ paletteId: 'custom', custom });
  }

  return (
    <Card>
      <ThemedText type="smallBold">Appearance</ThemedText>
      <Segmented<Mode>
        accessibilityLabel="Light or dark mode"
        options={[
          { value: 'system', label: 'System' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
        value={appearance.mode}
        onChange={(mode) => setAppearance({ mode })}
      />

      <View style={styles.swatches}>
        {PRESETS.map((p) => (
          <PaletteSwatch
            key={p.id}
            name={p.name}
            palette={p.palette}
            selected={appearance.paletteId === p.id}
            onPress={() => setAppearance({ paletteId: p.id })}
          />
        ))}
        <PaletteSwatch name="Custom" palette={custom} selected={isCustom} onPress={chooseCustom} />
      </View>

      {isCustom &&
        ROLES.map((role) => (
          <ColorRow key={role.key} label={role.label} color={custom[role.key]} onPress={() => setEditing(role.key)} />
        ))}

      <ColorPickerModal
        visible={editing !== null}
        title={ROLES.find((r) => r.key === editing)?.label ?? ''}
        value={editing ? custom[editing] : '#000000'}
        onClose={() => setEditing(null)}
        onDone={(hex) => {
          if (editing) setAppearance({ paletteId: 'custom', custom: { ...custom, [editing]: hex } });
          setEditing(null);
        }}
      />
    </Card>
  );
}

function PaletteSwatch({
  name,
  palette,
  selected,
  onPress,
}: {
  name: string;
  palette: Palette;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${name} palette`}
      onPress={onPress}
      style={styles.swatchItem}>
      <View style={[styles.ring, { borderColor: selected ? theme.accent : 'transparent' }]}>
        <View style={styles.swatch}>
          <View style={[styles.swatchMain, { backgroundColor: palette.main }]} />
          <View style={styles.swatchBottom}>
            <View style={[styles.flex, { backgroundColor: palette.secondary }]} />
            <View style={[styles.flex, { backgroundColor: palette.tertiary }]} />
          </View>
        </View>
      </View>
      <ThemedText type="small" themeColor={selected ? 'text' : 'textSecondary'}>
        {name}
      </ThemedText>
    </Pressable>
  );
}

function ColorRow({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} colour, ${color}`}
      onPress={onPress}
      style={({ pressed }) => [styles.colorRow, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.dot, { backgroundColor: color, borderColor: theme.border }]} />
      <ThemedText style={styles.flex}>{label}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {color}
      </ThemedText>
    </Pressable>
  );
}

const SWATCH = 44;

const styles = StyleSheet.create({
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  swatchItem: { alignItems: 'center', gap: Spacing.one, width: SWATCH + 16 },
  ring: { borderWidth: 2.5, borderRadius: SWATCH, padding: 2 },
  swatch: { width: SWATCH, height: SWATCH, borderRadius: SWATCH / 2, overflow: 'hidden' },
  swatchMain: { flex: 1 },
  swatchBottom: { flex: 1, flexDirection: 'row' },
  flex: { flex: 1 },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1 },
});
