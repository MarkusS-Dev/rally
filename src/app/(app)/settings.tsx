import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppearanceCard } from '@/components/appearance-card';
import { TimeWheel } from '@/components/time-wheel';
import { Button, Card, Field, Loading, Notice, Row, Screen } from '@/components/ui';
import { useFocusQuery } from '@/hooks/use-focus-query';
import { useTheme } from '@/hooks/use-theme';
import { signOut } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/errors';
import { getMySettings, updateDisplayName, updateSettings } from '@/lib/api/settings';
import type { MySettings } from '@/lib/api/types';
import { applyReminder, getSavedReminderTime } from '@/lib/reminders';
import { formatKg } from '@/lib/stats';
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

      <AppearanceCard />


      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Signed in as {session?.user.email}
        </ThemedText>
        <Button title="Sign out" variant="secondary" onPress={() => signOut().catch(() => {})} />
      </Card>
    </Screen>
  );
}

/** Name, goal and the daily reminder; read-only until you tap Edit. */
function ProfileForm({ initial, onSaved }: { initial: MySettings; onSaved: () => void }) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initial.displayName);
  const [goal, setGoal] = useState(initial.goalWeightKg?.toFixed(1) ?? '');
  // The reminder is stored on this phone only; nothing is sent to the server.
  const [savedReminder, setSavedReminder] = useState(getSavedReminderTime);
  const [reminderOn, setReminderOn] = useState(savedReminder !== null);
  // The wheels use 5-minute steps, so round an older saved time to match.
  const [time, setTime] = useState(() => joinTime(...splitTime(savedReminder ?? DEFAULT_REMINDER)));
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<Message>(null);

  function cancel() {
    setName(initial.displayName);
    setGoal(initial.goalWeightKg?.toFixed(1) ?? '');
    setReminderOn(savedReminder !== null);
    setTime(joinTime(...splitTime(savedReminder ?? DEFAULT_REMINDER)));
    setErrors({});
    setMessage(null);
    setEditing(false);
  }

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
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fieldErrors);
        if (e.kind !== 'validation') setMessage({ text: e.message, tone: 'error' });
      } else {
        setMessage({ text: `Could not save: ${describe(e)}`, tone: 'error' });
      }
      setBusy(false);
      return;
    }

    const reminder = reminderOn ? time : null;
    if (reminder !== savedReminder) {
      try {
        const result = await applyReminder(reminder);
        if (result === 'denied' || result === 'unsupported') {
          setMessage({
            text:
              result === 'denied'
                ? 'Notifications are blocked for this app. Allow them in your phone settings, then save again.'
                : "Reminders aren't available here (only in the phone app).",
            tone: 'error',
          });
          setBusy(false);
          return;
        }
        setSavedReminder(reminder);
      } catch (e) {
        console.error('Reminder failed:', e);
        setMessage({ text: `Could not set the reminder: ${describe(e)}`, tone: 'error' });
        setBusy(false);
        return;
      }
    }

    setBusy(false);
    setEditing(false);
    onSaved();
  }

  return (
    <Card>
      <Row style={styles.spread}>
        <ThemedText type="smallBold">Profile</ThemedText>
        {!editing && (
          <Pressable accessibilityRole="button" onPress={() => setEditing(true)} hitSlop={12}>
            <ThemedText type="linkPrimary">Edit</ThemedText>
          </Pressable>
        )}
      </Row>

      {editing ? (
        <>
          <Field label="Your name" value={name} onChangeText={setName} autoCapitalize="words" errors={errors.displayName} />
          <Field
            label="Goal weight (kg)"
            placeholder="Optional"
            value={goal}
            onChangeText={setGoal}
            keyboardType="decimal-pad"
            errors={errors.goalWeight}
          />
          <Row style={styles.spread}>
            <ThemedText type="smallBold">Daily reminder</ThemedText>
            <Switch
              value={reminderOn}
              onValueChange={setReminderOn}
              trackColor={{ true: theme.accent }}
              accessibilityLabel="Daily reminder"
            />
          </Row>
          {reminderOn && <TimeWheel value={time} onChange={setTime} />}
          <Notice message={message?.text} tone={message?.tone} />
          <Row style={styles.nowrap}>
            <View style={styles.flex}>
              <Button title="Cancel" variant="secondary" onPress={cancel} disabled={busy} />
            </View>
            <View style={styles.flex}>
              <Button title="Save" onPress={save} loading={busy} />
            </View>
          </Row>
        </>
      ) : (
        <>
          <Row style={styles.spread}>
            <ThemedText themeColor="textSecondary">Name</ThemedText>
            <ThemedText>{initial.displayName}</ThemedText>
          </Row>
          <Row style={styles.spread}>
            <ThemedText themeColor="textSecondary">Goal</ThemedText>
            <ThemedText>{initial.goalWeightKg != null ? formatKg(initial.goalWeightKg) : '–'}</ThemedText>
          </Row>
          <Row style={styles.spread}>
            <ThemedText themeColor="textSecondary">Reminder</ThemedText>
            <ThemedText>{savedReminder ?? 'Off'}</ThemedText>
          </Row>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  spread: { justifyContent: 'space-between', flexWrap: 'nowrap' },
  nowrap: { flexWrap: 'nowrap' },
  flex: { flex: 1 },
});
