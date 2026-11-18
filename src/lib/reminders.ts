// Daily "time to weigh in" reminder, as a repeating local notification.
// Local notifications work in Expo Go; no push server is involved.

import 'expo-sqlite/localStorage/install';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'daily-reminder';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

// The chosen time is stored on this phone only: each device has its own
// notification schedule, so there's nothing to sync to the server.
const STORAGE_KEY = 'rally.reminderTime';

/** Saved reminder time ("HH:MM") for this phone, or null if off. */
export function getSavedReminderTime(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveReminderTime(time: string | null) {
  if (time) localStorage.setItem(STORAGE_KEY, time);
  else localStorage.removeItem(STORAGE_KEY);
}

export type ReminderResult = 'scheduled' | 'off' | 'denied' | 'unsupported';

/** Run one step, and say which step it was if it fails (for diagnosing device-specific errors). */
async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    throw new Error(`${name} failed: ${reason}`);
  }
}

/**
 * Make the device's schedule match `time` ("HH:MM", or null for off).
 * With `askPermission: false` it never shows the permission prompt; used when
 * re-syncing on app start.
 */
export async function applyReminder(
  time: string | null,
  { askPermission = true }: { askPermission?: boolean } = {},
): Promise<ReminderResult> {
  if (Platform.OS === 'web') return 'unsupported';

  saveReminderTime(time);
  await step('Clearing old reminders', () => Notifications.cancelAllScheduledNotificationsAsync());
  if (!time) return 'off';

  // Our own Android channel is nice to have, not required: Expo Go's native
  // channel code can throw a NullPointerException here. Without a channel the
  // notification goes to Expo's default channel instead.
  let channelId: string | undefined;
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Daily weigh-in reminder',
        // Exported via `export *`, which the import/namespace lint rule can't follow.
        // eslint-disable-next-line import/namespace
        importance: Notifications.AndroidImportance.DEFAULT,
      });
      channelId = CHANNEL_ID;
    } catch (e) {
      console.warn('Notification channel not created; using the default channel.', e);
    }
  }

  let permission = await step('Checking notification permission', () => Notifications.getPermissionsAsync());
  if (!permission.granted && askPermission) {
    permission = await step('Asking for notification permission', () => Notifications.requestPermissionsAsync());
  }
  if (!permission.granted) return 'denied';

  const [hour, minute] = time.split(':').map(Number);
  await step('Scheduling the daily reminder', () =>
    Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time to weigh in',
        body: "Log today's weight and keep the rally going.",
        // Explicit values so Android never reads these as missing (null).
        data: { kind: 'daily-reminder' },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        ...(channelId ? { channelId } : {}),
      },
    }),
  );
  return 'scheduled';
}
