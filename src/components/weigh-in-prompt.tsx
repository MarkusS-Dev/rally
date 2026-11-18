// "Time to weigh in" card: big number on the left, scroll wheel on the right.
// Starts at the previous weigh-in so you only nudge it up or down.

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Notice } from '@/components/ui';
import { WeightWheel } from '@/components/weight-wheel';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { WeighIn } from '@/lib/api/types';
import { createWeighIn, updateWeighIn } from '@/lib/api/weigh-ins';
import { formatChangeKg, formatKg } from '@/lib/stats';

const FIRST_TIME_DEFAULT_KG = 80;

export function WeighInPrompt({
  previous,
  todays,
  today,
  onSaved,
  onDismiss,
}: {
  /** Latest weigh-in before today, used as the starting value. */
  previous: WeighIn | null;
  /** Today's weigh-in if there already is one (then saving replaces it). */
  todays: WeighIn | null;
  today: string;
  onSaved: () => void;
  onDismiss?: () => void;
}) {
  const theme = useTheme();
  const start = todays?.weightKg ?? previous?.weightKg ?? FIRST_TIME_DEFAULT_KG;
  const [kg, setKg] = useState(start);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (todays) await updateWeighIn(todays.id, { weight: kg, unit: 'kg' });
      else await createWeighIn({ weight: kg, unit: 'kg', measuredOn: today }, today);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  const diff = previous ? Math.round((kg - previous.weightKg) * 10) / 10 : null;

  return (
    <Card>
      <View style={styles.layout}>
        <View style={styles.left}>
          <ThemedText type="smallBold">{todays ? "Change today's weight" : 'Time to weigh in'}</ThemedText>
          <ThemedText style={styles.big}>{kg.toFixed(1)}</ThemedText>
          <ThemedText themeColor="textSecondary">kg</ThemedText>
          {previous && (
            <ThemedText type="small" themeColor="textSecondary">
              Last: {formatKg(previous.weightKg)}
              {diff !== null && diff !== 0 ? (
                <ThemedText type="small" style={{ color: diff < 0 ? theme.success : theme.textSecondary }}>
                  {'  '}
                  {formatChangeKg(diff)}
                </ThemedText>
              ) : null}
            </ThemedText>
          )}
        </View>
        <WeightWheel value={kg} onChange={setKg} />
      </View>

      <Notice message={error} />
      <Button title={todays ? 'Update' : 'Save'} onPress={save} loading={busy} />
      {onDismiss && <Button title="Not now" variant="secondary" onPress={onDismiss} disabled={busy} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  layout: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  left: { flex: 1, gap: Spacing.one },
  big: { fontSize: 56, lineHeight: 64, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
