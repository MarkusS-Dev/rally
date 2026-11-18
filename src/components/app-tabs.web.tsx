// Web fallback for the tab bar (native tabs are iOS/Android only).
// Handy for quick checks in a browser; the phone app is the real target.

import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  const theme = useTheme();
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList style={[styles.bar, { backgroundColor: theme.backgroundElement }]}>
        <TabTrigger name="index" href="/" asChild>
          <TabButton>Trend</TabButton>
        </TabTrigger>
        <TabTrigger name="groups" href="/groups" asChild>
          <TabButton>Groups</TabButton>
        </TabTrigger>
        <TabTrigger name="settings" href="/settings" asChild>
          <TabButton>Settings</TabButton>
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const theme = useTheme();
  return (
    // `ref` from the slot props doesn't match Pressable's ref type; it isn't needed.
    <Pressable {...props} ref={undefined} style={styles.button}>
      <View>
        <Text style={{ color: isFocused ? theme.accent : theme.textSecondary, fontWeight: '600' }}>
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.three,
  },
  button: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
});
