import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Field, Loading, Notice, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useFocusQuery } from '@/hooks/use-focus-query';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api/errors';
import { createGroup, joinGroup, listMyGroups } from '@/lib/api/groups';
import type { Group } from '@/lib/api/types';

export default function GroupsScreen() {
  const query = useFocusQuery(listMyGroups);

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

      <GroupForm
        title="Join a group"
        label="Invite code"
        placeholder="e.g. C0FFEE42"
        button="Join"
        field="inviteCode"
        autoCapitalize="characters"
        submit={joinGroup}
      />
      <GroupForm
        title="Create a group"
        label="Group name"
        placeholder="e.g. Gym Buddies"
        button="Create"
        field="name"
        autoCapitalize="sentences"
        submit={createGroup}
      />
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
          {group.isOwner ? 'Owner · ' : ''}View leaderboard ›
        </ThemedText>
      </Pressable>
    </Link>
  );
}

function GroupForm(props: {
  title: string;
  label: string;
  placeholder: string;
  button: string;
  field: 'inviteCode' | 'name';
  autoCapitalize: 'characters' | 'sentences';
  submit: (value: string) => Promise<Group>;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[] | undefined>();

  async function go() {
    setBusy(true);
    setErrors(undefined);
    try {
      const group = await props.submit(value);
      setValue('');
      router.push({ pathname: '/groups/[id]', params: { id: group.id } });
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fieldErrors[props.field] ?? [e.message]);
      else setErrors(['Could not reach the server. Check your connection.']);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <ThemedText type="smallBold">{props.title}</ThemedText>
      <Field
        label={props.label}
        placeholder={props.placeholder}
        value={value}
        onChangeText={setValue}
        autoCapitalize={props.autoCapitalize}
        autoCorrect={false}
        onSubmitEditing={go}
        errors={errors}
      />
      <Button title={props.button} variant="secondary" onPress={go} loading={busy} disabled={!value.trim()} />
    </Card>
  );
}

const styles = StyleSheet.create({
  groupLink: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.one },
  groupName: { fontSize: 18 },
});
