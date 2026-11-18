import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { GroupChart, type ChartSeries } from '@/components/group-chart';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Loading, Notice, Row, Screen, Segmented } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useFocusQuery } from '@/hooks/use-focus-query';
import { useTheme } from '@/hooks/use-theme';
import {
  deleteGroup,
  getGroupRankings,
  getGroupWeighIns,
  leaveGroup,
  listGroupMembers,
  listMyGroups,
} from '@/lib/api/groups';
import type { Group, GroupMember, RankingCategory, RankingEntry, RankingMetric } from '@/lib/api/types';
import { confirm } from '@/lib/confirm';
import { addDays, formatChangeKg, formatKg, formatPct, rankingFor } from '@/lib/stats';
import { localToday } from '@/lib/validation';

const CHART_RANGES = [
  { label: 'Week', days: 7 },
  { label: 'Month', days: 30 },
  { label: 'Total', days: null },
] as const;
type ChartRange = (typeof CHART_RANGES)[number]['label'];

const CURRENT: { category: RankingCategory; title: string; hint: string }[] = [
  { category: 'day', title: 'Today', hint: 'Since yesterday (people who weighed in today)' },
  { category: 'week', title: 'This week', hint: 'Last 7 days' },
  { category: 'month', title: 'This month', hint: 'Last 30 days' },
  { category: 'total', title: 'All time', hint: 'Since the first weigh-in' },
];

const RECORDS: { category: RankingCategory; title: string; hint: string }[] = [
  { category: 'best_day', title: 'Best single day', hint: 'Biggest drop between two days in a row' },
  { category: 'best_week', title: 'Best 7 days', hint: 'Biggest drop within any 7 days' },
  { category: 'best_month', title: 'Best 30 days', hint: 'Biggest drop within any 30 days' },
];

// Distinct line colours for members; "you" always get the brand orange.
const MEMBER_COLORS = ['#2E86DE', '#10AC84', '#8E44AD', '#F39C12', '#E84393', '#00A8B5', '#6D4C41', '#7F8C8D'];

async function loadGroup(id: string) {
  const [groups, members, rankings] = await Promise.all([
    listMyGroups(),
    listGroupMembers(id),
    getGroupRankings(id),
  ]);
  const group = groups.find((g) => g.id === id);
  if (!group) throw new Error("This group doesn't exist anymore, or you're no longer in it.");
  return { group, members, rankings };
}

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [metric, setMetric] = useState<RankingMetric>('pct');
  const [range, setRange] = useState<ChartRange>('Month');
  const [menuOpen, setMenuOpen] = useState(false);
  const theme = useTheme();

  const query = useFocusQuery(() => loadGroup(id), id);
  const days = CHART_RANGES.find((r) => r.label === range)!.days;
  const chart = useFocusQuery(
    () => getGroupWeighIns(id, days === null ? undefined : addDays(localToday(), -days)),
    `${id}:${range}`,
  );

  if (!query.data) {
    return (
      <Screen underHeader>
        {query.status === 'error' ? <Notice message={query.error.message} /> : <Loading />}
      </Screen>
    );
  }

  const { group, members, rankings } = query.data;
  const meId = rankings.find((r) => r.isMe)?.userId;
  const colorOf = memberColors(members, meId, theme.accent);

  const series: ChartSeries[] = members.map((m) => ({
    userId: m.userId,
    name: m.displayName,
    color: colorOf(m.userId),
    isMe: m.userId === meId,
    points: (chart.data ?? []).filter((w) => w.userId === m.userId),
  }));

  return (
    <Screen underHeader>
      <Stack.Screen
        options={{
          title: group.name,
          headerRight: () => <MenuButton open={menuOpen} onPress={() => setMenuOpen((o) => !o)} />,
        }}
      />
      {menuOpen && <GroupMenu group={group} />}
      {query.status === 'error' && <Notice message={query.error.message} />}

      <Card>
        <Row style={styles.cardHeader}>
          <ThemedText type="smallBold">{metric === 'kg' ? 'Weight' : 'Change'}</ThemedText>
          <Segmented
            accessibilityLabel="Show kilograms or percent"
            options={[
              { value: 'pct', label: '%' },
              { value: 'kg', label: 'kg' },
            ]}
            value={metric}
            onChange={setMetric}
          />
        </Row>
        <Row>
          {CHART_RANGES.map((r) => (
            <Chip key={r.label} label={r.label} selected={range === r.label} onPress={() => setRange(r.label)} />
          ))}
        </Row>
        {chart.data ? (
          <GroupChart series={series} metric={metric} />
        ) : chart.status === 'error' ? (
          <Notice message={chart.error.message} />
        ) : (
          <Loading />
        )}
      </Card>

      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.section}>
        {metric === 'kg' ? 'KG LOST' : '% LOST'} · NOW
      </ThemedText>
      {CURRENT.map((c) => (
        <RankingCard
          key={c.category}
          title={c.title}
          hint={c.hint}
          entries={rankingFor(rankings, c.category, metric)}
          metric={metric}
          colorOf={colorOf}
          showWeight
        />
      ))}

      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.section}>
        {metric === 'kg' ? 'KG LOST' : '% LOST'} · RECORDS
      </ThemedText>
      {RECORDS.map((c) => (
        <RankingCard
          key={c.category}
          title={c.title}
          hint={c.hint}
          entries={rankingFor(rankings, c.category, metric)}
          metric={metric}
          colorOf={colorOf}
        />
      ))}

      {members.length === 1 && (
        <ThemedText type="small" themeColor="textSecondary">
          It&apos;s just you so far. Invite friends from the ⋯ menu.
        </ThemedText>
      )}
    </Screen>
  );
}

function memberColors(members: GroupMember[], meId: string | undefined, myColor: string) {
  const others = members.filter((m) => m.userId !== meId);
  return (userId: string) => {
    if (userId === meId) return myColor;
    const i = others.findIndex((m) => m.userId === userId);
    return MEMBER_COLORS[(i < 0 ? 0 : i) % MEMBER_COLORS.length];
  };
}

const MEDALS = ['🥇', '🥈', '🥉'];

function RankingCard({
  title,
  hint,
  entries,
  metric,
  colorOf,
  showWeight = false,
}: {
  title: string;
  hint: string;
  entries: RankingEntry[];
  metric: RankingMetric;
  colorOf: (userId: string) => string;
  showWeight?: boolean;
}) {
  const theme = useTheme();
  return (
    <Card style={styles.rankingCard}>
      <View>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      </View>
      {entries.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No data yet.
        </ThemedText>
      ) : (
        entries.map((e, i) => {
          const value = metric === 'kg' ? e.changeKg : e.pctChange;
          const color = value < 0 ? theme.success : value > 0 ? theme.text : theme.textSecondary;
          return (
            <Row key={e.userId} style={[styles.rankRow, e.isMe && { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText style={styles.rank}>{MEDALS[i] ?? `${i + 1}`}</ThemedText>
              <View style={[styles.dot, { backgroundColor: colorOf(e.userId) }]} />
              <View style={styles.flex}>
                <ThemedText type="smallBold">
                  {e.displayName}
                  {e.isMe ? ' (you)' : ''}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {showWeight
                    ? e.currentWeightKg !== null
                      ? `Now ${formatKg(e.currentWeightKg)}`
                      : ''
                    : `${e.fromDate} → ${e.toDate}`}
                </ThemedText>
              </View>
              <ThemedText type="smallBold" style={{ color }}>
                {metric === 'kg' ? formatChangeKg(e.changeKg) : formatPct(e.pctChange)}
              </ThemedText>
            </Row>
          );
        })
      )}
    </Card>
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
        { backgroundColor: open ? theme.backgroundSelected : theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
      ]}>
      <ThemedText type="smallBold" style={styles.menuIcon}>
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
    <View style={[styles.menu, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="small" themeColor="textSecondary">
        Invite code
      </ThemedText>
      <ThemedText type="subtitle" selectable style={styles.code}>
        {group.inviteCode}
      </ThemedText>
      <Button title="Invite friends" variant="secondary" onPress={share} />
      <Notice message={error} />
      <Button title={group.isOwner ? 'Delete group' : 'Leave group'} variant="danger" onPress={leaveOrDelete} loading={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  cardHeader: { justifyContent: 'space-between', flexWrap: 'nowrap' },
  section: { marginTop: Spacing.two, letterSpacing: 1 },
  rankingCard: { gap: Spacing.two },
  rankRow: { flexWrap: 'nowrap', paddingVertical: Spacing.one, paddingHorizontal: Spacing.two, borderRadius: Spacing.two },
  rank: { width: 28, textAlign: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  menuButton: { borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  menuIcon: { fontSize: 22, lineHeight: 26 },
  menu: { borderWidth: 1, borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  code: { letterSpacing: 4, textAlign: 'center' },
});
