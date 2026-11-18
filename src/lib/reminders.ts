// Daily "time to weigh in" reminder, as a repeating local notification.
// Local notifications work in Expo Go; no push server is involved.

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

export type ReminderResult = 'scheduled' | 'off' | 'denied' | 'unsupported';

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

  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!time) return 'off';

  if (Platform.OS === 'android') {
    // Android 13+ only shows the permission prompt once a channel exists.
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Daily weigh-in reminder',
      // Exported via `export *`, which the import/namespace lint rule can't follow.
      // eslint-disable-next-line import/namespace
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && askPermission) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (!permission.granted) return 'denied';

  const [hour, minute] = time.split(':').map(Number);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to weigh in',
      body: "Log today's weight and keep the rally going.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: CHANNEL_ID,
    },
  });
  return 'scheduled';
}
