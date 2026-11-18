// Home: asks for today's weight first (if not logged yet), then shows the trend.

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Field, Loading, Notice, Row, Screen, Toggle, ToggleRow } from '@/components/ui';
import { WeighInPrompt } from '@/components/weigh-in-prompt';
import { WeightChart } from '@/components/weight-chart';
import { Spacing } from '@/constants/theme';
import { useFocusQuery } from '@/hooks/use-focus-query';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api/errors';
import { getMySettings } from '@/lib/api/settings';
import type { WeighIn } from '@/lib/api/types';
import {
  deleteWeighIn,
  getFirstWeighIn,
  listAllWeighInsSince,
  listWeighIns,
  updateWeighIn,
} from '@/lib/api/weigh-ins';
import { confirm } from '@/lib/confirm';
import { addDays, formatChangeKg, formatKg, goalProgress } from '@/lib/stats';
import { localToday } from '@/lib/validation';

const RANGES = [
  { label: 'Week', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: 'All', days: null },
] as const;
type RangeLabel = (typeof RANGES)[number]['label'];

async function loadTrend(days: number | null) {
  const today = localToday();
  const [settings, recent, first, points] = await Promise.all([
    getMySettings(),
    listWeighIns({ pageSize: 2 }),
    getFirstWeighIn(),
    listAllWeighInsSince(days === null ? undefined : addDays(today, -days)),
  ]);
  const todays = recent.items.find((w) => w.measuredOn === today) ?? null;
  const previous = recent.items.find((w) => w.measuredOn < today) ?? null;
  return { today, todays, previous, first, points, goalKg: settings.goalWeightKg };
}

export default function TrendScreen() {
  const [range, setRange] = useState<RangeLabel>('30 days');
  const days = RANGES.find((r) => r.label === range)!.days;
  const query = useFocusQuery(() => loadTrend(days), range);
  const [dismissed, setDismissed] = useState(false);
  const [changingToday, setChangingToday] = useState(false);
  const [showWeighIns, setShowWeighIns] = useState(true);
  const [showTrend, setShowTrend] = useState(true);

  if (!query.data) {
    return (
      <Screen title="Trend">
        {query.status === 'error' ? <Notice message={query.error.message} /> : <Loading />}
      </Screen>
    );
  }

  const { today, todays, previous, first, points, goalKg } = query.data;
  const showPrompt = changingToday || (!todays && !dismissed);

  // Step 1: weigh in. Step 2 (after saving or "Not now"): the trend.
  if (showPrompt) {
    return (
      <Screen title="Trend">
        <WeighInPrompt
          key={todays?.id ?? 'new'}
          previous={previous}
          todays={changingToday ? todays : null}
          today={today}
          onSaved={() => {
            setChangingToday(false);
            query.reload();
          }}
          onDismiss={() => (changingToday ? setChangingToday(false) : setDismissed(true))}
        />
      </Screen>
    );
  }

  const latest = todays ?? previous;

  return (
    <Screen title="Trend">
      {query.status === 'error' && <Notice message={query.error.message} />}

      {todays ? (
        <Card>
          <Row style={styles.spread}>
            <View>
              <ThemedText type="small" themeColor="textSecondary">
                Today ✓
              </ThemedText>
              <ThemedText type="subtitle">{formatKg(todays.weightKg)}</ThemedText>
            </View>
            <Pressable accessibilityRole="button" onPress={() => setChangingToday(true)} hitSlop={12}>
              <ThemedText type="linkPrimary">Change</ThemedText>
            </Pressable>
          </Row>
          {latest && first && goalKg != null && <GoalBar startKg={first.weightKg} latestKg={latest.weightKg} goalKg={goalKg} />}
        </Card>
      ) : (
        <Card>
          <Button title="Weigh in" onPress={() => setDismissed(false)} />
          {latest && first && goalKg != null && <GoalBar startKg={first.weightKg} latestKg={latest.weightKg} goalKg={goalKg} />}
        </Card>
      )}

      <Row>
        {RANGES.map((r) => (
          <Chip key={r.label} label={r.label} selected={range === r.label} onPress={() => setRange(r.label)} />
        ))}
      </Row>

      {points.length === 0 ? (
        <Card>
          <ThemedText themeColor="textSecondary">No weigh-ins in this period yet.</ThemedText>
        </Card>
      ) : (
        <>
          <Card>
            <RangeSummary points={points} />
            <WeightChart points={points} goalKg={goalKg} showWeighIns={showWeighIns} showTrend={showTrend} />
            <ToggleRow>
              <Toggle label="Weigh-ins" value={showWeighIns} onChange={setShowWeighIns} />
              <Toggle label="Trend" value={showTrend} onChange={setShowTrend} />
            </ToggleRow>
          </Card>
          <Card style={styles.list}>
            {[...points].reverse().map((w) => (
              <HistoryRow key={w.id} item={w} onChanged={query.reload} />
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

function GoalBar({ startKg, latestKg, goalKg }: { startKg: number; latestKg: number; goalKg: number }) {
  const theme = useTheme();
  const progress = goalProgress(startKg, latestKg, goalKg);
  if (!progress) return null;
  return (
    <View style={styles.goal}>
      <Row style={styles.spread}>
        <ThemedText type="smallBold">Goal {formatKg(goalKg)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {progress.reached ? 'Reached! 🎉' : `${formatKg(progress.remainingKg)} to go`}
        </ThemedText>
      </Row>
      <View
        style={[styles.track, { backgroundColor: theme.backgroundSelected }]}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress.fraction * 100) }}>
        <View
          style={[
            styles.fill,
            {
              width: `${progress.fraction * 100}%`,
              backgroundColor: progress.reached ? theme.success : theme.accent,
            },
          ]}
        />
      </View>
    </View>
  );
}

function RangeSummary({ points }: { points: WeighIn[] }) {
  const theme = useTheme();
  const change = Math.round((points[points.length - 1].weightKg - points[0].weightKg) * 10) / 10;
  return (
    <Row style={styles.spread}>
      <View>
        <ThemedText type="small" themeColor="textSecondary">
          Change
        </ThemedText>
        <ThemedText type="smallBold" style={change < 0 ? { color: theme.success } : undefined}>
          {formatChangeKg(change)}
        </ThemedText>
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
      setError(e instanceof ApiError ? (e.fieldErrors.weight ?? [e.message]) : [String(e)]);
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
      setError([e instanceof Error ? e.message : String(e)]);
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
          {item.lastModifiedAt ? (
            <ThemedText type="small" themeColor="textSecondary">
              {' '}
              · edited
            </ThemedText>
          ) : null}
        </ThemedText>
      </Pressable>
      {editing && (
        <View style={styles.editor}>
          <Field label="Weight (kg)" value={value} onChangeText={setValue} keyboardType="decimal-pad" errors={error} />
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
  spread: { justifyContent: 'space-between', flexWrap: 'nowrap' },
  goal: { gap: Spacing.two },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  list: { gap: 0, paddingVertical: Spacing.one },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: Spacing.two },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.two },
  editor: { gap: Spacing.two, paddingBottom: Spacing.two },
  flex: { flex: 1 },
});
