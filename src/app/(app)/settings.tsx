import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Field, Loading, Notice, Row, Screen } from '@/components/ui';
import { useFocusQuery } from '@/hooks/use-focus-query';
import { useTheme } from '@/hooks/use-theme';
import { signOut } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/errors';
import { getMySettings, updateDisplayName, updateSettings } from '@/lib/api/settings';
import type { MySettings } from '@/lib/api/types';
import { applyReminder } from '@/lib/reminders';
import { useSession } from '@/lib/session';
import { normalizeTime, type FieldErrors } from '@/lib/validation';

const DEFAULT_REMINDER = '08:00';

export default function SettingsScreen() {
  const query = useFocusQuery(getMySettings);
  const { session } = useSession();

  return (
    <Screen title="Settings">
      {query.status === 'error' && <Notice message={query.error.message} />}
      {query.data ? (
        // Re-mount the form when fresh settings arrive so the fields reset.
        <SettingsForm key={JSON.stringify(query.data)} initial={query.data} onSaved={query.reload} />
      ) : (
        query.status === 'loading' && <Loading />
      )}

      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Signed in as {session?.user.email}
        </ThemedText>
        <Button title="Sign out" variant="secondary" onPress={() => signOut().catch(() => {})} />
      </Card>
    </Screen>
  );
}

function SettingsForm({ initial, onSaved }: { initial: MySettings; onSaved: () => void }) {
  const theme = useTheme();
  const [name, setName] = useState(initial.displayName);
  const [goal, setGoal] = useState(initial.goalWeightKg?.toFixed(1) ?? '');
  const [reminderOn, setReminderOn] = useState(initial.reminderTime !== null);
  const [time, setTime] = useState(initial.reminderTime ?? DEFAULT_REMINDER);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);

  async function save() {
    setBusy(true);
    setErrors({});
    setMessage(null);
    try {
      const reminderTime = reminderOn ? normalizeTime(time) : null;
      if (reminderOn && !reminderTime) {
        setErrors({ reminderTime: ['Use 24-hour time, e.g. 07:30.'] });
        return;
      }
      const goalWeight = goal.trim() === '' ? null : Number(goal.replace(',', '.'));

      await Promise.all([
        name.trim() !== initial.displayName ? updateDisplayName(name) : Promise.resolve(),
        updateSettings({ goalWeight, unit: 'kg', reminderTime }),
      ]);

      const reminder = await applyReminder(reminderTime);
      setMessage(
        reminder === 'denied'
          ? { text: 'Saved, but notifications are blocked. Allow them in your phone settings to get reminders.', tone: 'error' }
          : { text: 'Saved.', tone: 'info' },
      );
      onSaved();
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fieldErrors);
        if (e.kind !== 'validation') setMessage({ text: e.message, tone: 'error' });
      } else {
        setMessage({ text: 'Could not save. Check your connection.', tone: 'error' });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Field
        label="Your name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        errors={errors.displayName}
      />
      <Field
        label="Goal weight (kg)"
        placeholder="Optional"
        value={goal}
        onChangeText={setGoal}
        keyboardType="decimal-pad"
        errors={errors.goalWeight}
      />

      <Row style={styles.switchRow}>
        <View style={styles.flex}>
          <ThemedText type="smallBold">Daily reminder</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            A notification to weigh in each day
          </ThemedText>
        </View>
        <Switch
          value={reminderOn}
          onValueChange={setReminderOn}
          trackColor={{ true: theme.accent }}
          accessibilityLabel="Daily reminder"
        />
      </Row>
      {reminderOn && (
        <Field
          label="Reminder time (24-hour)"
          placeholder="08:00"
          value={time}
          onChangeText={setTime}
          keyboardType="numbers-and-punctuation"
          errors={errors.reminderTime}
        />
      )}

      <Notice message={message?.text} tone={message?.tone} />
      <Button title="Save" onPress={save} loading={busy} />
    </Card>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexWrap: 'nowrap' },
  flex: { flex: 1 },
});
