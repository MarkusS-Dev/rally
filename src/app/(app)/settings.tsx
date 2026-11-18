import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TimeWheel } from '@/components/time-wheel';
import { Button, Card, Field, Loading, Notice, Row, Screen } from '@/components/ui';
import { useFocusQuery } from '@/hooks/use-focus-query';
import { useTheme } from '@/hooks/use-theme';
import { signOut } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/errors';
import { getMySettings, updateDisplayName, updateSettings } from '@/lib/api/settings';
import type { MySettings } from '@/lib/api/types';
import { applyReminder, getSavedReminderTime } from '@/lib/reminders';
import { useSession } from '@/lib/session';
import { joinTime, splitTime } from '@/lib/time';
import type { FieldErrors } from '@/lib/validation';

const DEFAULT_REMINDER = '08:00';

type Message = { text: string; tone: 'error' | 'info' } | null;

/** The real reason something failed, so problems can actually be diagnosed. */
function describe(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

export default function SettingsScreen() {
  const query = useFocusQuery(getMySettings);
  const { session } = useSession();

  return (
    <Screen title="Settings">
      {query.status === 'error' && <Notice message={query.error.message} />}
      {query.data ? (
        // Re-mount the form when fresh settings arrive so the fields reset.
        <ProfileForm key={JSON.stringify(query.data)} initial={query.data} onSaved={query.reload} />
      ) : (
        query.status === 'loading' && <Loading />
      )}

      <ReminderForm />

      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Signed in as {session?.user.email}
        </ThemedText>
        <Button title="Sign out" variant="secondary" onPress={() => signOut().catch(() => {})} />
      </Card>
    </Screen>
  );
}

function ProfileForm({ initial, onSaved }: { initial: MySettings; onSaved: () => void }) {
  const [name, setName] = useState(initial.displayName);
  const [goal, setGoal] = useState(initial.goalWeightKg?.toFixed(1) ?? '');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<Message>(null);

  async function save() {
    setBusy(true);
    setErrors({});
    setMessage(null);
    try {
      const goalWeight = goal.trim() === '' ? null : Number(goal.replace(',', '.'));
      await Promise.all([
        name.trim() !== initial.displayName ? updateDisplayName(name) : Promise.resolve(),
        updateSettings({ goalWeight, unit: 'kg' }),
      ]);
      setMessage({ text: 'Saved.', tone: 'info' });
      onSaved();
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fieldErrors);
        if (e.kind !== 'validation') setMessage({ text: e.message, tone: 'error' });
      } else {
        setMessage({ text: `Could not save: ${describe(e)}`, tone: 'error' });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <ThemedText type="smallBold">Profile</ThemedText>
      <Field label="Your name" value={name} onChangeText={setName} autoCapitalize="words" errors={errors.displayName} />
      <Field
        label="Goal weight (kg)"
        placeholder="Optional"
        value={goal}
        onChangeText={setGoal}
        keyboardType="decimal-pad"
        errors={errors.goalWeight}
      />
      <Notice message={message?.text} tone={message?.tone} />
      <Button title="Save" onPress={save} loading={busy} />
    </Card>
  );
}

/** Stored on this phone only; nothing is sent to the server. */
function ReminderForm() {
  const theme = useTheme();
  const [saved] = useState(getSavedReminderTime);
  const [on, setOn] = useState(saved !== null);
  // The wheels use 5-minute steps, so round an older saved time to match.
  const [time, setTime] = useState(() => joinTime(...splitTime(saved ?? DEFAULT_REMINDER)));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  async function save() {
    setMessage(null);
    const normalized = on ? time : null;
    setBusy(true);
    try {
      const result = await applyReminder(normalized);
      setMessage(
        result === 'scheduled'
          ? { text: `Reminder set for ${normalized} every day.`, tone: 'info' }
          : result === 'off'
            ? { text: 'Reminder turned off.', tone: 'info' }
            : result === 'denied'
              ? { text: 'Notifications are blocked for this app. Allow them in your phone settings, then save again.', tone: 'error' }
              : { text: "Reminders aren't available here (only in the phone app).", tone: 'error' },
      );
    } catch (e) {
      setMessage({ text: `Could not set the reminder: ${describe(e)}`, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Row style={styles.switchRow}>
        <View style={styles.flex}>
          <ThemedText type="smallBold">Daily reminder</ThemedText>
        </View>
        <Switch value={on} onValueChange={setOn} trackColor={{ true: theme.accent }} accessibilityLabel="Daily reminder" />
      </Row>
      {on && <TimeWheel value={time} onChange={setTime} />}
      <Notice message={message?.text} tone={message?.tone} />
      <Button title="Save reminder" variant="secondary" onPress={save} loading={busy} />
    </Card>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexWrap: 'nowrap' },
  flex: { flex: 1 },
});
