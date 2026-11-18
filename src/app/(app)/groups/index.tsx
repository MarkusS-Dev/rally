import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Field, Loading, Notice, Row, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useFocusQuery } from '@/hooks/use-focus-query';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api/errors';
import { createGroup, joinGroup, listMyGroups } from '@/lib/api/groups';
import type { Group } from '@/lib/api/types';

export default function GroupsScreen() {
  const query = useFocusQuery(listMyGroups);
  const [manageOpen, setManageOpen] = useState(false);

  return (
    <Screen title="Groups">
      {query.status === 'error' && <Notice message={query.error.message} />}
      {!query.data ? (
        query.status === 'loading' && <Loading />
      ) : query.data.length === 0 ? (
        <Card>
          <ThemedText themeColor="textSecondary">
            You&apos;re not in a group yet. Create one and share the invite code with your friends, or join
            theirs.
          </ThemedText>
        </Card>
      ) : (
        query.data.map((g) => <GroupLink key={g.id} group={g} />)
      )}

      <Button title="Manage groups" variant="secondary" onPress={() => setManageOpen(true)} />
      <ManageGroupsModal visible={manageOpen} onClose={() => setManageOpen(false)} />
    </Screen>
  );
}

function GroupLink({ group }: { group: Group }) {
  const theme = useTheme();
  return (
    <Link href={{ pathname: '/groups/[id]', params: { id: group.id } }} asChild>
      <Pressable
        accessibilityRole="link"
        style={({ pressed }) => [
          styles.groupLink,
          { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.75 : 1 },
        ]}>
        <ThemedText type="smallBold" style={styles.groupName}>
          {group.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {group.isOwner ? 'Owner · ' : ''}Leaderboard and chart ›
        </ThemedText>
      </Pressable>
    </Link>
  );
}

type Tab = 'join' | 'create';

/** Popup with "Join a group" and "Create a group". */
function ManageGroupsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('join');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[] | undefined>();

  function switchTab(next: Tab) {
    setTab(next);
    setValue('');
    setErrors(undefined);
  }

  function close() {
    switchTab('join');
    onClose();
  }

  async function submit() {
    setBusy(true);
    setErrors(undefined);
    try {
      const group = tab === 'join' ? await joinGroup(value) : await createGroup(value);
      close();
      router.push({ pathname: '/groups/[id]', params: { id: group.id } });
    } catch (e) {
      const field = tab === 'join' ? 'inviteCode' : 'name';
      if (e instanceof ApiError) setErrors(e.fieldErrors[field] ?? [e.message]);
      else setErrors([e instanceof Error ? e.message : String(e)]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.four },
          ]}>
          <Row style={styles.sheetHeader}>
            <ThemedText type="smallBold" style={styles.sheetTitle}>
              Manage groups
            </ThemedText>
            <Pressable onPress={close} hitSlop={12} accessibilityRole="button">
              <ThemedText type="linkPrimary">Close</ThemedText>
            </Pressable>
          </Row>

          <Row>
            <Chip label="Join a group" selected={tab === 'join'} onPress={() => switchTab('join')} />
            <Chip label="Create a group" selected={tab === 'create'} onPress={() => switchTab('create')} />
          </Row>

          <ThemedText type="small" themeColor="textSecondary">
            {tab === 'join'
              ? 'Ask a friend for their group’s 8-character invite code (in the ⋯ menu on their group).'
              : 'You’ll get an invite code to share with your friends.'}
          </ThemedText>

          <Field
            key={tab}
            label={tab === 'join' ? 'Invite code' : 'Group name'}
            placeholder={tab === 'join' ? 'e.g. C0FFEE42' : 'e.g. Gym Buddies'}
            value={value}
            onChangeText={setValue}
            autoCapitalize={tab === 'join' ? 'characters' : 'sentences'}
            autoCorrect={false}
            autoFocus
            onSubmitEditing={submit}
            errors={errors}
          />
          <Button title={tab === 'join' ? 'Join' : 'Create'} onPress={submit} loading={busy} disabled={!value.trim()} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  groupLink: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.one },
  groupName: { fontSize: 18 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  sheetHeader: { justifyContent: 'space-between', flexWrap: 'nowrap' },
  sheetTitle: { fontSize: 18 },
});
