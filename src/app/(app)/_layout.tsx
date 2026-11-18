import { useEffect } from 'react';

import AppTabs from '@/components/app-tabs';
import { applyReminder, getSavedReminderTime } from '@/lib/reminders';

export default function AppLayout() {
  // Make sure this phone's reminder is scheduled (e.g. after an app update).
  // Never pops a permission prompt here.
  useEffect(() => {
    const time = getSavedReminderTime();
    if (time) applyReminder(time, { askPermission: false }).catch(() => {});
  }, []);

  return <AppTabs />;
}
