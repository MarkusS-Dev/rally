import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Field, Loading, Notice, Row, Screen } from '@/components/ui';
import { WeightChart } from '@/components/weight-chart';
import { Spacing } from '@/constants/theme';
import { useFocusQuery } from '@/hooks/use-focus-query';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api/errors';
import { getMySettings } from '@/lib/api/settings';
import type { WeighIn } from '@/lib/api/types';
import { deleteWeighIn, listAllWeighInsSince, updateWeighIn } from '@/lib/api/weigh-ins';
import { addDays, formatChangeKg, formatKg } from '@/lib/stats';
import { confirm } from '@/lib/confirm';
import { localToday } from '@/lib/validation';

const RANGES = [
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '1 year', days: 365 },
  { label: 'All', days: null },
] as const;

type RangeLabel = (typeof RANGES)[number]['label'];

export default function HistoryScreen() {
  const [range, setRange] = useState<RangeLabel>('90 days');
  const days = RANGES.find((r) => r.label === range)!.days;

  const query = useFocusQuery(async () => {
    const from = days === null ? undefined : addDays(localToday(), -days);
    const [points, settings] = await Promise.all([listAllWeighInsSince(from), getMySettings()]);
    return { points, goalKg: settings.goalWeightKg };
  }, range);

  return (
    <Screen title="History">
      <Row>
        {RANGES.map((r) => (
          <Chip key={r.label} label={r.label} selected={range === r.label} onPress={() => setRange(r.label)} />
        ))}
      </Row>

      {query.status === 'error' && <Notice message={query.error.message} />}
      {!query.data ? (
        query.status === 'loading' && <Loading />
      ) : query.data.points.length === 0 ? (
        <Card>
          <ThemedText themeColor="textSecondary">No weigh-ins in this period yet.</ThemedText>
        </Card>
      ) : (
        <>
          <Card>
            <RangeSummary points={query.data.points} />
            <WeightChart points={query.data.points} goalKg={query.data.goalKg} />
          </Card>
          <Card style={styles.list}>
            {[...query.data.points].reverse().map((w) => (
              <HistoryRow key={w.id} item={w} onChanged={query.reload} />
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

function RangeSummary({ points }: { points: WeighIn[] }) {
  const first = points[0];
  const last = points[points.length - 1];
  return (
    <Row style={styles.summary}>
      <View>
        <ThemedText type="small" themeColor="textSecondary">
          Change
        </ThemedText>
        <ThemedText type="smallBold">{formatChangeKg(last.weightKg - first.weightKg)}</ThemedText>
      </View>
      <View>
        <ThemedText type="small" themeColor="textSecondary">
          Lowest
        </ThemedText>
        <ThemedText type="smallBold">{formatKg(Math.min(...points.map((p) => p.weightKg)))}</ThemedText>
      </View>
      <View>
        <ThemedText type="small" themeColor="textSecondary">
          Weigh-ins
        </ThemedText>
        <ThemedText type="smallBold">{points.length}</ThemedText>
      </View>
    </Row>
  );
}

/** One weigh-in; tap to edit or delete it. */
function HistoryRow({ item, onChanged }: { item: WeighIn; onChanged: () => void }) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.weightKg.toFixed(1));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string[] | undefined>();

  async function save() {
    setBusy(true);
    setError(undefined);
    try {
      await updateWeighIn(item.id, { weight: Number(value.replace(',', '.')), unit: 'kg' });
      setEditing(false);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? (e.fieldErrors.weight ?? [e.message]) : ['Could not save.']);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!(await confirm('Delete weigh-in?', `${formatKg(item.weightKg)} on ${item.measuredOn}`, 'Delete'))) return;
    setBusy(true);
    try {
      await deleteWeighIn(item.id);
      onChanged();
    } catch (e) {
      setError([e instanceof Error ? e.message : 'Could not delete.']);
      setBusy(false);
    }
  }

  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Edit or delete this weigh-in"
        onPress={() => setEditing((e) => !e)}
        style={styles.rowHeader}>
        <ThemedText>{item.measuredOn}</ThemedText>
        <ThemedText type="smallBold">
          {formatKg(item.weightKg)}
          {item.lastModifiedAt ? <ThemedText type="small" themeColor="textSecondary"> · edited</ThemedText> : null}
        </ThemedText>
      </Pressable>
      {editing && (
        <View style={styles.editor}>
          <Field
            label="Weight (kg)"
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            errors={error}
          />
          <Row>
            <View style={styles.flex}>
              <Button title="Save" onPress={save} loading={busy} />
            </View>
            <View style={styles.flex}>
              <Button title="Delete" variant="danger" onPress={remove} disabled={busy} />
            </View>
          </Row>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { justifyContent: 'space-between' },
  list: { gap: 0, paddingVertical: Spacing.one },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: Spacing.two },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.two },
  editor: { gap: Spacing.two, paddingBottom: Spacing.two },
  flex: { flex: 1 },
});
