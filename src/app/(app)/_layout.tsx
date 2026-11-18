import { useEffect } from 'react';

import AppTabs from '@/components/app-tabs';
import { getMySettings } from '@/lib/api/settings';
import { applyReminder } from '@/lib/reminders';

export default function AppLayout() {
  // Re-sync the daily reminder with the saved setting (e.g. after reinstalling
  // or signing in on a new phone). Never pops a permission prompt here.
  useEffect(() => {
    getMySettings()
      .then((s) => applyReminder(s.reminderTime, { askPermission: false }))
      .catch(() => {}); // not worth bothering the user about on launch
  }, []);

  return <AppTabs />;
}
