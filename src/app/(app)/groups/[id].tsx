import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Loading, Notice, Row, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useFocusQuery } from '@/hooks/use-focus-query';
import { useTheme } from '@/hooks/use-theme';
import { deleteGroup, getLeaderboard, leaveGroup, listMyGroups } from '@/lib/api/groups';
import type { Group, LeaderboardEntry, LeaderboardPeriod } from '@/lib/api/types';
import { confirm } from '@/lib/confirm';
import { formatChangeKg, formatKg, formatPct } from '@/lib/stats';

const PERIODS: { value: LeaderboardPeriod; label: string; hint: string }[] = [
  { value: 'week', label: 'Week', hint: 'Change over the last 7 days.' },
  { value: 'month', label: 'Month', hint: 'Change over the last 30 days.' },
  { value: 'total', label: 'Total', hint: 'Change since each person’s first weigh-in.' },
];

async function loadGroup(id: string, period: LeaderboardPeriod) {
  const [groups, leaderboard] = await Promise.all([listMyGroups(), getLeaderboard(id, period)]);
  const group = groups.find((g) => g.id === id);
  if (!group) throw new Error("This group doesn't exist anymore, or you're no longer in it.");
  return { group, leaderboard };
}

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [period, setPeriod] = useState<LeaderboardPeriod>('week');
  const query = useFocusQuery(() => loadGroup(id, period), `${id}:${period}`);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!query.data) {
    return (
      <Screen underHeader>
        {query.status === 'error' ? <Notice message={query.error.message} /> : <Loading />}
      </Screen>
    );
  }

  const { group, leaderboard } = query.data;
  const ranked = leaderboard.filter((e) => e.pctChange !== null);
  const unranked = leaderboard.filter((e) => e.pctChange === null);

  return (
    <Screen underHeader title={group.name}>
      <Stack.Screen options={{ title: group.name }} />
      {query.status === 'error' && <Notice message={query.error.message} />}

      <Card style={styles.board}>
        <Row style={styles.header}>
          <ThemedText type="smallBold">Leaderboard</ThemedText>
          <MenuButton open={menuOpen} onPress={() => setMenuOpen((o) => !o)} />
        </Row>

        {menuOpen && <GroupMenu group={group} />}

        <Row>
          {PERIODS.map((p) => (
            <Chip key={p.value} label={p.label} selected={period === p.value} onPress={() => setPeriod(p.value)} />
          ))}
        </Row>
        <ThemedText type="small" themeColor="textSecondary">
          {PERIODS.find((p) => p.value === period)!.hint} Most weight lost (in %) ranks first.
        </ThemedText>

        {ranked.map((entry, i) => (
          <LeaderboardRow key={entry.userId} entry={entry} rank={i + 1} />
        ))}
        {unranked.map((entry) => (
          <LeaderboardRow key={entry.userId} entry={entry} rank={null} />
        ))}
        {leaderboard.length === 1 && (
          <ThemedText type="small" themeColor="textSecondary">
            It&apos;s just you so far. Invite friends from the ⋯ menu.
          </ThemedText>
        )}
      </Card>
    </Screen>
  );
}

function MenuButton({ open, onPress }: { open: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Group options"
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      hitSlop={12}
      style={({ pressed }) => [
        styles.menuButton,
        { backgroundColor: open ? theme.backgroundSelected : 'transparent', opacity: pressed ? 0.6 : 1 },
      ]}>
      <ThemedText type="smallBold" style={{ fontSize: 20, lineHeight: 22 }}>
        ⋯
      </ThemedText>
    </Pressable>
  );
}

/** Invite friends + leave/delete, tucked away behind the ⋯ button. */
function GroupMenu({ group }: { group: Group }) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function share() {
    await Share.share({ message: `Join my group "${group.name}" on Rally! Invite code: ${group.inviteCode}` });
  }

  async function leaveOrDelete() {
    const deleting = group.isOwner;
    const ok = await confirm(
      deleting ? 'Delete group?' : 'Leave group?',
      deleting
        ? `"${group.name}" will be removed for everyone. Weigh-ins are not affected.`
        : 'You can rejoin later with the invite code.',
      deleting ? 'Delete' : 'Leave',
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      if (deleting) await deleteGroup(group.id);
      else await leaveGroup(group.id);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <View style={[styles.menu, { borderColor: theme.border, backgroundColor: theme.background }]}>
      <ThemedText type="small" themeColor="textSecondary">
        Invite code
      </ThemedText>
      <ThemedText type="subtitle" selectable style={styles.code}>
        {group.inviteCode}
      </ThemedText>
      <Button title="Invite friends" variant="secondary" onPress={share} />
      <Notice message={error} />
      <Button
        title={group.isOwner ? 'Delete group' : 'Leave group'}
        variant="danger"
        onPress={leaveOrDelete}
        loading={busy}
      />
    </View>
  );
}

function LeaderboardRow({ entry, rank }: { entry: LeaderboardEntry; rank: number | null }) {
  const theme = useTheme();
  const lost = entry.changeKg !== null && entry.changeKg < 0;
  const changeColor = entry.changeKg === null ? theme.textSecondary : lost ? theme.success : theme.text;

  return (
    <Row style={[styles.row, entry.isMe && { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.rank}>
        {rank ?? '–'}
      </ThemedText>
      <View style={styles.who}>
        <ThemedText type="smallBold">
          {entry.displayName}
          {entry.isMe ? ' (you)' : ''}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {entry.currentWeightKg !== null ? formatKg(entry.currentWeightKg) : 'No weigh-ins yet'}
          {entry.lastWeighedOn ? ` · ${entry.lastWeighedOn}` : ''}
        </ThemedText>
      </View>
      {entry.changeKg === null || entry.pctChange === null ? (
        <ThemedText type="small" themeColor="textSecondary">
          Not enough data
        </ThemedText>
      ) : (
        <View style={styles.change}>
          <ThemedText type="smallBold" style={{ color: changeColor }}>
            {formatPct(entry.pctChange)}
          </ThemedText>
          <ThemedText type="small" style={{ color: changeColor }}>
            {formatChangeKg(entry.changeKg)}
          </ThemedText>
        </View>
      )}
    </Row>
  );
}

const styles = StyleSheet.create({
  board: { gap: Spacing.two },
  header: { justifyContent: 'space-between', flexWrap: 'nowrap' },
  menuButton: { borderRadius: 999, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  menu: { borderWidth: 1, borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  code: { letterSpacing: 4, textAlign: 'center' },
  row: {
    flexWrap: 'nowrap',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
  rank: { width: 24, textAlign: 'center' },
  who: { flex: 1 },
  change: { alignItems: 'flex-end' },
});
