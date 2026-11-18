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
    <Screen
      title="Groups"
      action={
        <Pressable accessibilityRole="button" onPress={() => setManageOpen(true)} hitSlop={12}>
          <ThemedText type="linkPrimary">Manage groups</ThemedText>
        </Pressable>
      }>
      {query.status === 'error' && <Notice message={query.error.message} />}
      {!query.data ? (
        query.status === 'loading' && <Loading />
      ) : query.data.length === 0 ? (
        <Card>
          <ThemedText themeColor="textSecondary">No groups yet.</ThemedText>
        </Card>
      ) : (
        query.data.map((g) => <GroupLink key={g.id} group={g} />)
      )}

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
          { backgroundColor: theme.backgroundElement, borderColor: theme.accent, opacity: pressed ? 0.75 : 1 },
        ]}>
        <View style={styles.groupText}>
          <ThemedText type="smallBold" style={styles.groupName}>
            {group.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {group.isOwner ? 'Owner' : 'Member'}
          </ThemedText>
        </View>
        <ThemedText style={[styles.chevron, { color: theme.accent }]}>
          ›
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
  groupLink: {
    justifyContent: 'center',
    borderRadius: Spacing.three,
    borderWidth: 2,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.five,
  },
  groupText: { alignItems: 'center', gap: Spacing.one },
  // Pinned to the right edge so it doesn't push the centred text off-centre.
  chevron: { position: 'absolute', right: Spacing.three, fontSize: 28, lineHeight: 30 },
  groupName: { fontSize: 20, textAlign: 'center' },
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
