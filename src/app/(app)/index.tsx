import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Field, Loading, Notice, Row, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useFocusQuery } from '@/hooks/use-focus-query';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api/errors';
import { getMySettings } from '@/lib/api/settings';
import type { WeighIn } from '@/lib/api/types';
import { createWeighIn, getFirstWeighIn, listWeighIns, updateWeighIn } from '@/lib/api/weigh-ins';
import { addDays, formatChangeKg, formatKg, goalProgress, weeklyChangeKg } from '@/lib/stats';
import { localToday, type FieldErrors } from '@/lib/validation';

async function loadToday() {
  const today = localToday();
  const [settings, recent, first] = await Promise.all([
    getMySettings(),
    listWeighIns({ pageSize: 100, from: addDays(today, -60) }),
    getFirstWeighIn(),
  ]);
  return { settings, recent: recent.items, first, today };
}

export default function TodayScreen() {
  const query = useFocusQuery(loadToday);

  if (!query.data) {
    return (
      <Screen title="Today">
        {query.status === 'error' ? <Notice message={query.error.message} /> : <Loading />}
      </Screen>
    );
  }

  const { settings, recent, first, today } = query.data;
  const latest: WeighIn | undefined = recent[0];

  return (
    <Screen title={`Hi, ${settings.displayName}`}>
      {query.status === 'error' && <Notice message={query.error.message} />}
      <Summary latest={latest} recent={recent} first={first} goalKg={settings.goalWeightKg} />
      <LogWeight recent={recent} today={today} onSaved={query.reload} />
    </Screen>
  );
}

function Summary({
  latest,
  recent,
  first,
  goalKg,
}: {
  latest?: WeighIn;
  recent: WeighIn[];
  first: WeighIn | null;
  goalKg: number | null;
}) {
  const theme = useTheme();

  if (!latest) {
    return (
      <Card>
        <ThemedText type="smallBold">Welcome to Rally!</ThemedText>
        <ThemedText themeColor="textSecondary">
          Log your first weight below. Friends in your groups will only ever see your % change, never your
          actual weight.
        </ThemedText>
      </Card>
    );
  }

  const weekly = weeklyChangeKg(recent);
  const progress = goalKg != null && first ? goalProgress(first.weightKg, latest.weightKg, goalKg) : null;

  return (
    <Card>
      <View>
        <ThemedText themeColor="textSecondary" type="small">
          Latest · {latest.measuredOn}
        </ThemedText>
        <ThemedText type="title">{formatKg(latest.weightKg)}</ThemedText>
        {weekly !== null && (
          <ThemedText themeColor="textSecondary">{formatChangeKg(weekly)} in the last week</ThemedText>
        )}
      </View>

      {goalKg == null ? (
        <ThemedText themeColor="textSecondary" type="small">
          Set a goal weight in Settings to track your progress.
        </ThemedText>
      ) : progress ? (
        <View style={styles.goal}>
          <Row style={styles.goalLabels}>
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
                { width: `${progress.fraction * 100}%`, backgroundColor: progress.reached ? theme.success : theme.accent },
              ]}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Started at {formatKg(first!.weightKg)} on {first!.measuredOn}
          </ThemedText>
        </View>
      ) : null}
    </Card>
  );
}

function LogWeight({ recent, today, onSaved }: { recent: WeighIn[]; today: string; onSaved: () => void }) {
  const yesterday = addDays(today, -1);
  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const existing = recent.find((w) => w.measuredOn === date);

  async function save() {
    setBusy(true);
    setErrors({});
    setMessage(null);
    setSaved(null);
    // Accept "81,4" as well as "81.4".
    const value = Number(weight.replace(',', '.'));
    try {
      if (existing) {
        await updateWeighIn(existing.id, { weight: value, unit: 'kg' });
      } else {
        await createWeighIn({ weight: value, unit: 'kg', measuredOn: date }, today);
      }
      setWeight('');
      setSaved(existing ? 'Updated.' : 'Logged. Nice work!');
      onSaved();
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fieldErrors);
        if (e.kind !== 'validation') setMessage(e.message);
      } else {
        setMessage('Could not save. Check your connection.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <ThemedText type="smallBold">{existing ? 'Update weight' : 'Log weight'}</ThemedText>
      <Row>
        <Chip label="Today" selected={date === today} onPress={() => setDate(today)} />
        <Chip label="Yesterday" selected={date === yesterday} onPress={() => setDate(yesterday)} />
      </Row>
      {existing && (
        <ThemedText type="small" themeColor="textSecondary">
          You logged {formatKg(existing.weightKg)} for this day. Saving replaces it.
        </ThemedText>
      )}
      <Field
        label="Weight (kg)"
        placeholder={recent[0] ? recent[0].weightKg.toFixed(1) : 'e.g. 80.5'}
        value={weight}
        onChangeText={setWeight}
        keyboardType="decimal-pad"
        returnKeyType="done"
        onSubmitEditing={save}
        errors={[...(errors.weight ?? []), ...(errors.measuredOn ?? [])]}
      />
      <Notice message={message} />
      <Notice message={saved} tone="info" />
      <Button title={existing ? 'Update' : 'Save'} onPress={save} loading={busy} disabled={!weight.trim()} />
    </Card>
  );
}

const styles = StyleSheet.create({
  goal: { gap: Spacing.two },
  goalLabels: { justifyContent: 'space-between' },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
});
