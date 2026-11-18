// Time picker: an hour wheel and a minute wheel (5-minute steps).

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { joinTime, MINUTE_STEP, pad2, splitTime } from '@/lib/time';

import { Wheel } from './wheel';

export function TimeWheel({ value, onChange }: { value: string; onChange: (time: string) => void }) {
  const [hour, minute] = splitTime(value);
  return (
    <View style={styles.row}>
      <Wheel
        count={24}
        index={hour}
        onChange={(h) => onChange(joinTime(h, minute))}
        label={pad2}
        width={80}
        accessibilityLabel="Hour"
      />
      <ThemedText style={styles.colon}>:</ThemedText>
      <Wheel
        count={60 / MINUTE_STEP}
        index={minute / MINUTE_STEP}
        onChange={(i) => onChange(joinTime(hour, i * MINUTE_STEP))}
        label={(i) => pad2(i * MINUTE_STEP)}
        width={80}
        accessibilityLabel="Minute"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  colon: { fontSize: 24, lineHeight: 28, fontWeight: '700' },
});
