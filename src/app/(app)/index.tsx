// Home: asks for today's weight first (if not logged yet), then shows the trend.

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Loading, Notice, Row, Screen, Toggle, ToggleRow } from '@/components/ui';
import { WeighInPrompt } from '@/components/weigh-in-prompt';
import { WeightChart } from '@/components/weight-chart';
import { Spacing } from '@/constants/theme';
import { useFocusQuery } from '@/hooks/use-focus-query';
import { useTheme } from '@/hooks/use-theme';
import { getMySettings } from '@/lib/api/settings';
import { getMyStreak } from '@/lib/api/streaks';
import type { Streak, WeighIn } from '@/lib/api/types';
import { getFirstWeighIn, listAllWeighInsSince, listWeighIns } from '@/lib/api/weigh-ins';
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
  const [settings, recent, first, points, streak] = await Promise.all([
    getMySettings(),
    listWeighIns({ pageSize: 2 }),
    getFirstWeighIn(),
    listAllWeighInsSince(days === null ? undefined : addDays(today, -days)),
    getMyStreak(),
  ]);
  const todays = recent.items.find((w) => w.measuredOn === today) ?? null;
  const previous = recent.items.find((w) => w.measuredOn < today) ?? null;
  return { today, todays, previous, first, points, streak, goalKg: settings.goalWeightKg };
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

  const { today, todays, previous, first, points, streak, goalKg } = query.data;
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
          <StreakRow streak={streak} />
          {latest && first && goalKg != null && <GoalBar startKg={first.weightKg} latestKg={latest.weightKg} goalKg={goalKg} />}
        </Card>
      ) : (
        <Card>
          <Button title="Weigh in" onPress={() => setDismissed(false)} />
          <StreakRow streak={streak} />
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
        </>
      )}
    </Screen>
  );
}

function StreakRow({ streak }: { streak: Streak }) {
  if (streak.best === 0) return null;
  return (
    <Row style={styles.spread}>
      <View>
        <ThemedText type="small" themeColor="textSecondary">
          Streak
        </ThemedText>
        <ThemedText type="smallBold">🔥 {streakDays(streak.current)}</ThemedText>
      </View>
      <View style={styles.right}>
        <ThemedText type="small" themeColor="textSecondary">
          Best
        </ThemedText>
        <ThemedText type="smallBold">{streakDays(streak.best)}</ThemedText>
      </View>
    </Row>
  );
}

function streakDays(n: number) {
  return `${n} ${n === 1 ? 'day' : 'days'}`;
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

const styles = StyleSheet.create({
  spread: { justifyContent: 'space-between', flexWrap: 'nowrap' },
  goal: { gap: Spacing.two },
  right: { alignItems: 'flex-end' },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
});
