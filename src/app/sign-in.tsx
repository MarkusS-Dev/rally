import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Field, Notice, Row, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { signIn, signUp } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/errors';
import type { FieldErrors } from '@/lib/validation';

type Mode = 'sign-in' | 'sign-up';

export default function SignInScreen() {
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setFieldErrors({});
    setMessage(null);
  }

  async function submit() {
    setBusy(true);
    setFieldErrors({});
    setMessage(null);
    try {
      if (mode === 'sign-in') {
        await signIn(email, password);
        // The session listener swaps to the app automatically.
      } else {
        const needsConfirmation = await signUp(email, password, displayName);
        if (needsConfirmation) {
          switchMode('sign-in'); // clears the message, so set it afterwards
          setMessage({ text: 'Check your email for a confirmation link, then sign in.', tone: 'info' });
        }
      }
    } catch (e) {
      if (e instanceof ApiError) {
        setFieldErrors(e.fieldErrors);
        if (e.kind !== 'validation') setMessage({ text: e.message, tone: 'error' });
      } else {
        setMessage({ text: 'Could not reach the server. Check your connection.', tone: 'error' });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <ThemedText type="title" style={{ color: theme.accent }}>
          Rally
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.tagline}>
          Track your weight. Back your friends.
        </ThemedText>
      </View>

      <Card>
        <Row>
          <Chip label="Sign in" selected={mode === 'sign-in'} onPress={() => switchMode('sign-in')} />
          <Chip label="Create account" selected={mode === 'sign-up'} onPress={() => switchMode('sign-up')} />
        </Row>

        {mode === 'sign-up' && (
          <Field
            label="Your name"
            placeholder="What friends will see"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            textContentType="nickname"
            errors={fieldErrors.displayName}
          />
        )}
        <Field
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          errors={fieldErrors.email}
        />
        <Field
          label="Password"
          placeholder={mode === 'sign-up' ? 'At least 6 characters' : ''}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
          textContentType={mode === 'sign-up' ? 'newPassword' : 'password'}
          onSubmitEditing={submit}
          errors={fieldErrors.password}
        />

        <Notice message={message?.text} tone={message?.tone} />

        <Button title={mode === 'sign-in' ? 'Sign in' : 'Create account'} onPress={submit} loading={busy} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five },
  tagline: { textAlign: 'center' },
});
