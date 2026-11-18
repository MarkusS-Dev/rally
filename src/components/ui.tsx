// Small set of shared building blocks so every screen looks the same.

import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

/** Scrollable page body with safe-area padding. Set `underHeader` when a stack header is shown. */
export function Screen({
  children,
  title,
  action,
  underHeader = false,
}: {
  children: ReactNode;
  title?: string;
  /** Shown at the right end of the title row. */
  action?: ReactNode;
  underHeader?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.screen,
        {
          paddingTop: (underHeader ? 0 : insets.top) + Spacing.three,
          paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
        },
      ]}>
      {title ? (
        <View style={styles.titleRow}>
          <ThemedText type="subtitle">{title}</ThemedText>
          {action}
        </View>
      ) : null}
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }, style]}>{children}</View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const background =
    variant === 'primary' ? theme.accent : variant === 'danger' ? 'transparent' : theme.backgroundSelected;
  const color = variant === 'primary' ? theme.onAccent : variant === 'danger' ? theme.danger : theme.text;
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: inactive ? 0.5 : pressed ? 0.75 : 1 },
        variant === 'danger' && { borderWidth: 1, borderColor: theme.danger },
      ]}>
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <Text style={[styles.buttonText, { color }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  errors,
  ...input
}: TextInputProps & { label: string; errors?: string[] }) {
  const theme = useTheme();
  const hasError = !!errors?.length;
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        {...input}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.background,
            borderColor: hasError ? theme.danger : theme.border,
          },
        ]}
      />
      {errors?.map((e) => (
        <ThemedText key={e} type="small" style={{ color: theme.danger }}>
          {e}
        </ThemedText>
      ))}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.accent : theme.background,
          borderColor: selected ? theme.accent : theme.border,
        },
      ]}>
      <Text style={{ color: selected ? theme.onAccent : theme.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

/** A message banner for errors (or `tone="info"` for neutral notices). */
export function Notice({ message, tone = 'error' }: { message?: string | null; tone?: 'error' | 'info' }) {
  const theme = useTheme();
  if (!message) return null;
  const color = tone === 'error' ? theme.danger : theme.textSecondary;
  return (
    <View style={[styles.notice, { borderColor: color }]}>
      <ThemedText type="small" style={{ color }}>
        {message}
      </ThemedText>
    </View>
  );
}

export function Loading() {
  const theme = useTheme();
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={theme.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  screen: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.three },
  button: {
    minHeight: 48,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  field: { gap: Spacing.one },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 17,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  notice: { borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.three },
  loading: { paddingVertical: Spacing.six, alignItems: 'center' },
});

/** Compact two-or-more option pill, e.g. "% | kg". */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[segmentedStyles.track, { backgroundColor: theme.backgroundSelected }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            hitSlop={6}
            style={[segmentedStyles.option, selected && { backgroundColor: theme.background }]}>
            <Text style={{ color: selected ? theme.text : theme.textSecondary, fontWeight: '700', fontSize: 14 }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const segmentedStyles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: 999, padding: 3 },
  option: { minWidth: 40, alignItems: 'center', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999 },
});

/** A label with an on/off switch, right-aligned. */
export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={toggleStyles.row}>
      <ThemedText type="small">{label}</ThemedText>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: theme.accent }} accessibilityLabel={label} />
    </View>
  );
}

/** Toggles side by side, right-aligned. */
export function ToggleRow({ children }: { children: ReactNode }) {
  return <View style={toggleStyles.group}>{children}</View>;
}

const toggleStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.two },
  group: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', columnGap: Spacing.four },
});
