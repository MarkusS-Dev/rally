import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Loading, Notice, Row, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useFocusQuery } from '@/hooks/use-focus-query';
import { useTheme } from '@/hooks/use-theme';
import { confirm } from '@/lib/confirm';
import { deleteGroup, getLeaderboard, leaveGroup, listMyGroups } from '@/lib/api/groups';
import type { LeaderboardEntry } from '@/lib/api/types';
import { formatPct } from '@/lib/stats';

async function loadGroup(id: string) {
  const [groups, leaderboard] = await Promise.all([listMyGroups(), getLeaderboard(id)]);
  const group = groups.find((g) => g.id === id);
  if (!group) throw new Error("This group doesn't exist anymore, or you're no longer in it.");
  return { group, leaderboard };
}

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useFocusQuery(() => loadGroup(id), id);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!query.data) {
    return (
      <Screen underHeader>
        {query.status === 'error' ? <Notice message={query.error.message} /> : <Loading />}
      </Screen>
    );
  }

  const { group, leaderboard } = query.data;

  async function share() {
    await Share.share({
      message: `Join my group "${group.name}" on Rally! Invite code: ${group.inviteCode}`,
    });
  }

  async function leaveOrDelete() {
    const deleting = group.isOwner;
    const ok = await confirm(
      deleting ? 'Delete group?' : 'Leave group?',
      deleting
        ? `"${group.name}" will be removed for everyone. Weigh-ins are not affected.`
        : `You can rejoin later with the invite code.`,
      deleting ? 'Delete' : 'Leave',
    );
    if (!ok) return;
    setBusy(true);
    setActionError(null);
    try {
      if (deleting) await deleteGroup(group.id);
      else await leaveGroup(group.id);
      router.back();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <Screen underHeader title={group.name}>
      <Stack.Screen options={{ title: group.name }} />
      {query.status === 'error' && <Notice message={query.error.message} />}

      <Card style={styles.board}>
        <ThemedText type="smallBold">Leaderboard</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Change in weight since each person joined. Only percentages are shared, never actual weights.
        </ThemedText>
        {leaderboard.map((entry, i) => (
          <LeaderboardRow key={entry.userId} entry={entry} rank={entry.pctChange === null ? null : i + 1} />
        ))}
      </Card>

      <Card>
        <ThemedText type="smallBold">Invite friends</ThemedText>
        <ThemedText type="subtitle" selectable style={styles.code}>
          {group.inviteCode}
        </ThemedText>
        <Button title="Share invite code" variant="secondary" onPress={share} />
      </Card>

      <Notice message={actionError} />
      <Button
        title={group.isOwner ? 'Delete group' : 'Leave group'}
        variant="danger"
        onPress={leaveOrDelete}
        loading={busy}
      />
    </Screen>
  );
}

function LeaderboardRow({ entry, rank }: { entry: LeaderboardEntry; rank: number | null }) {
  const theme = useTheme();
  const pctColor =
    entry.pctChange === null ? theme.textSecondary : entry.pctChange < 0 ? theme.success : theme.text;

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
          {entry.weighInCount} weigh-in{entry.weighInCount === 1 ? '' : 's'}
          {entry.lastWeighedOn ? ` · last ${entry.lastWeighedOn}` : ''}
        </ThemedText>
      </View>
      <ThemedText type="smallBold" style={{ color: pctColor }}>
        {entry.pctChange === null ? 'Not enough data' : formatPct(entry.pctChange)}
      </ThemedText>
    </Row>
  );
}

const styles = StyleSheet.create({
  board: { gap: Spacing.two },
  row: { flexWrap: 'nowrap', paddingVertical: Spacing.two, paddingHorizontal: Spacing.two, borderRadius: Spacing.two },
  rank: { width: 24, textAlign: 'center' },
  who: { flex: 1 },
  code: { letterSpacing: 4, textAlign: 'center' },
});
