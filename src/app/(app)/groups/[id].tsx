import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { GroupChart, type ChartSeries } from '@/components/group-chart';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Loading, Notice, Row, Screen, Segmented, Toggle, ToggleRow } from '@/components/ui';
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
import type {
  Group,
  GroupMember,
  GroupStreak,
  RankingCategory,
  RankingEntry,
  RankingMetric,
  StreakEntry,
} from '@/lib/api/types';
import { getGroupStreak, getGroupStreaks } from '@/lib/api/streaks';
import { confirm } from '@/lib/confirm';
import { addDays, formatChangeKg, formatKg, formatPct, rankingFor } from '@/lib/stats';
import { localToday } from '@/lib/validation';

const CHART_RANGES = [
  { label: 'Week', days: 7 },
  { label: 'Month', days: 30 },
  { label: 'Total', days: null },
] as const;
type ChartRange = (typeof CHART_RANGES)[number]['label'];

// Each period: the ranking right now, plus the best stretch of that length ever.
const PERIODS: { label: string; current: RankingCategory; record: RankingCategory | null }[] = [
  { label: 'Day', current: 'day', record: 'best_day' },
  { label: 'Week', current: 'week', record: 'best_week' },
  { label: 'Month', current: 'month', record: 'best_month' },
  { label: 'All time', current: 'total', record: null },
];

// Distinct line colours for members; "you" always get the brand orange.
const MEMBER_COLORS = ['#2E86DE', '#10AC84', '#8E44AD', '#F39C12', '#E84393', '#00A8B5', '#6D4C41', '#7F8C8D'];

async function loadGroup(id: string) {
  const [groups, members, rankings, streaks, groupStreak] = await Promise.all([
    listMyGroups(),
    listGroupMembers(id),
    getGroupRankings(id),
    getGroupStreaks(id),
    getGroupStreak(id),
  ]);
  const group = groups.find((g) => g.id === id);
  if (!group) throw new Error("This group doesn't exist anymore, or you're no longer in it.");
  return { group, members, rankings, streaks, groupStreak };
}

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [metric, setMetric] = useState<RankingMetric>('pct');
  const [rankMetric, setRankMetric] = useState<RankingMetric>('pct');
  const [periodLabel, setPeriodLabel] = useState('Week');
  const [range, setRange] = useState<ChartRange>('Month');
  const [menuOpen, setMenuOpen] = useState(false);
  const theme = useTheme();
  const [showWeighIns, setShowWeighIns] = useState(true);
  const [showTrend, setShowTrend] = useState(true);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());

  function toggleMember(userId: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

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

  const { group, members, rankings, streaks, groupStreak } = query.data;
  const period = PERIODS.find((p) => p.label === periodLabel) ?? PERIODS[1];
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

      <GroupStreakCard streak={groupStreak} members={members} meId={meId} colorOf={colorOf} />

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
          <GroupChart
            series={series}
            metric={metric}
            showWeighIns={showWeighIns}
            showTrend={showTrend}
            hidden={hidden}
            onToggleMember={toggleMember}
          />
        ) : chart.status === 'error' ? (
          <Notice message={chart.error.message} />
        ) : (
          <Loading />
        )}
        <ToggleRow>
          <Toggle label="Weigh-ins" value={showWeighIns} onChange={setShowWeighIns} />
          <Toggle label="Trend" value={showTrend} onChange={setShowTrend} />
        </ToggleRow>
      </Card>

      <Card>
        <Row style={styles.cardHeader}>
          <ThemedText type="smallBold">Rankings</ThemedText>
          <Segmented
            accessibilityLabel="Rank by percent or kilograms"
            options={[
              { value: 'pct', label: '%' },
              { value: 'kg', label: 'kg' },
            ]}
            value={rankMetric}
            onChange={setRankMetric}
          />
        </Row>
        <Row>
          {PERIODS.map((p) => (
            <Chip key={p.label} label={p.label} selected={period.label === p.label} onPress={() => setPeriodLabel(p.label)} />
          ))}
        </Row>
        <RankingList
          title="Now"
          entries={rankingFor(rankings, period.current, rankMetric)}
          metric={rankMetric}
          colorOf={colorOf}
          showWeight
        />
        {period.record && (
          <RankingList
            title="Record"
            entries={rankingFor(rankings, period.record, rankMetric)}
            metric={rankMetric}
            colorOf={colorOf}
          />
        )}
      </Card>

      <StreakCard streaks={streaks} colorOf={colorOf} />
    </Screen>
  );
}

/** The whole group's streak, plus who has and hasn't weighed in today. */
function GroupStreakCard({
  streak,
  members,
  meId,
  colorOf,
}: {
  streak: GroupStreak;
  members: GroupMember[];
  meId: string | undefined;
  colorOf: (userId: string) => string;
}) {
  const missing = new Set(streak.missingToday);
  const done = members.filter((m) => !missing.has(m.userId));
  const waiting = members.filter((m) => missing.has(m.userId));

  async function nudge(name: string) {
    const message =
      streak.current > 0
        ? `Hey ${name}! Time to weigh in 💪 Our group streak is at ${days(streak.current)}, let's keep it going!`
        : `Hey ${name}! Time to weigh in 💪 Let's start a group streak today!`;
    await Share.share({ message }).catch(() => {});
  }

  return (
    <Card>
      <Row style={styles.cardHeader}>
        <View>
          <ThemedText type="small" themeColor="textSecondary">
            Group streak
          </ThemedText>
          <ThemedText type="subtitle">🔥 {days(streak.current)}</ThemedText>
        </View>
        <View style={styles.alignEnd}>
          <ThemedText type="small" themeColor="textSecondary">
            Best
          </ThemedText>
          <ThemedText type="smallBold">{days(streak.best)}</ThemedText>
        </View>
      </Row>

      <View style={styles.todayList}>
        {waiting.map((m) => (
          <Row key={m.userId} style={styles.todayRow}>
            <View style={[styles.dot, { backgroundColor: colorOf(m.userId) }]} />
            <ThemedText style={styles.flex}>
              {m.displayName}
              {m.userId === meId ? ' (you)' : ''}
            </ThemedText>
            {m.userId !== meId && (
              <Pressable accessibilityRole="button" accessibilityLabel={`Nudge ${m.displayName}`} onPress={() => nudge(m.displayName)} hitSlop={8}>
                <ThemedText type="linkPrimary">Nudge</ThemedText>
              </Pressable>
            )}
            <ThemedText style={styles.status}>⏳</ThemedText>
          </Row>
        ))}
        {done.map((m) => (
          <Row key={m.userId} style={styles.todayRow}>
            <View style={[styles.dot, { backgroundColor: colorOf(m.userId) }]} />
            <ThemedText style={styles.flex}>
              {m.displayName}
              {m.userId === meId ? ' (you)' : ''}
            </ThemedText>
            <ThemedText style={styles.status}>✅</ThemedText>
          </Row>
        ))}
      </View>
    </Card>
  );
}

type StreakView = 'now' | 'best';

/** Days in a row with a weigh-in, ranked. The top of "Best" is the group record. */
function StreakCard({ streaks, colorOf }: { streaks: StreakEntry[]; colorOf: (userId: string) => string }) {
  const theme = useTheme();
  const [view, setView] = useState<StreakView>('now');
  const value = (s: StreakEntry) => (view === 'now' ? s.current : s.best);
  const ranked = streaks
    .filter((s) => value(s) > 0)
    .sort((a, b) => value(b) - value(a) || a.displayName.localeCompare(b.displayName));

  return (
    <Card>
      <Row style={styles.cardHeader}>
        <ThemedText type="smallBold">Streaks 🔥</ThemedText>
        <Segmented
          accessibilityLabel="Current or best streaks"
          options={[
            { value: 'now', label: 'Now' },
            { value: 'best', label: 'Best' },
          ]}
          value={view}
          onChange={setView}
        />
      </Row>
      {ranked.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No streaks yet.
        </ThemedText>
      ) : (
        ranked.map((s, i) => (
          <Row key={s.userId} style={[styles.rankRow, s.isMe && { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText style={styles.rank}>{MEDALS[i] ?? `${i + 1}`}</ThemedText>
            <View style={[styles.dot, { backgroundColor: colorOf(s.userId) }]} />
            <View style={styles.flex}>
              <ThemedText type="smallBold">
                {s.displayName}
                {s.isMe ? ' (you)' : ''}
              </ThemedText>
              {view === 'best' && s.bestFrom && (
                <ThemedText type="small" themeColor="textSecondary">
                  {s.bestFrom} → {s.bestTo}
                </ThemedText>
              )}
            </View>
            <ThemedText type="smallBold">{days(value(s))}</ThemedText>
          </Row>
        ))
      )}
    </Card>
  );
}

function days(n: number) {
  return `${n} ${n === 1 ? 'day' : 'days'}`;
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

function RankingList({
  title,
  entries,
  metric,
  colorOf,
  showWeight = false,
}: {
  title: string;
  entries: RankingEntry[];
  metric: RankingMetric;
  colorOf: (userId: string) => string;
  showWeight?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.rankingList}>
      <ThemedText type="small" themeColor="textSecondary">
        {title}
      </ThemedText>
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
    </View>
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
  alignEnd: { alignItems: 'flex-end' },
  todayList: { gap: Spacing.one },
  todayRow: { flexWrap: 'nowrap', alignItems: 'center', minHeight: 32 },
  status: { width: 28, textAlign: 'center' },
  cardHeader: { justifyContent: 'space-between', flexWrap: 'nowrap' },
  rankingList: { gap: Spacing.one, marginTop: Spacing.two },
  rankRow: { flexWrap: 'nowrap', paddingVertical: Spacing.one, paddingHorizontal: Spacing.two, borderRadius: Spacing.two },
  rank: { width: 28, textAlign: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  menuButton: { borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  menuIcon: { fontSize: 22, lineHeight: 26 },
  menu: { borderWidth: 1, borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  code: { letterSpacing: 4, textAlign: 'center' },
});
