import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Field, Notice, Row, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { requestPasswordReset, resetPassword, signIn, signUp } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/errors';
import type { FieldErrors } from '@/lib/validation';

type Mode = 'sign-in' | 'sign-up' | 'reset';

export default function SignInScreen() {
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setCodeSent(false);
    setCode('');
    setFieldErrors({});
    setMessage(null);
  }

  async function sendCode() {
    await requestPasswordReset(email);
    setCodeSent(true);
    setCode('');
    setPassword('');
    setMessage({ text: `Code sent to ${email.trim()}.`, tone: 'info' });
  }

  async function resend() {
    setBusy(true);
    setFieldErrors({});
    setMessage(null);
    try {
      await sendCode();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }

  function showError(e: unknown) {
    if (e instanceof ApiError) {
      setFieldErrors(e.fieldErrors);
      if (e.kind !== 'validation') setMessage({ text: e.message, tone: 'error' });
    } else {
      setMessage({ text: 'Could not reach the server. Check your connection.', tone: 'error' });
    }
  }

  async function submit() {
    setBusy(true);
    setFieldErrors({});
    setMessage(null);
    try {
      if (mode === 'reset') {
        if (!codeSent) await sendCode();
        else await resetPassword(email, code, password); // signs in; the session listener takes over
      } else if (mode === 'sign-in') {
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
      showError(e);
    } finally {
      setBusy(false);
    }
  }

  const submitTitle =
    mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : codeSent ? 'Set new password' : 'Send code';

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
        {mode === 'reset' ? (
          <ThemedText type="smallBold">Reset password</ThemedText>
        ) : (
          <Row>
            <Chip label="Sign in" selected={mode === 'sign-in'} onPress={() => switchMode('sign-in')} />
            <Chip label="Create account" selected={mode === 'sign-up'} onPress={() => switchMode('sign-up')} />
          </Row>
        )}

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
        {!(mode === 'reset' && codeSent) && (
          <Field
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            onSubmitEditing={mode === 'reset' ? submit : undefined}
            errors={fieldErrors.email}
          />
        )}
        {mode === 'reset' && codeSent && (
          <Field
            label="Code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={10}
            errors={fieldErrors.code}
          />
        )}
        {(mode !== 'reset' || codeSent) && (
          <Field
            label={mode === 'reset' ? 'New password' : 'Password'}
            placeholder={mode === 'sign-in' ? '' : 'At least 6 characters'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            textContentType={mode === 'sign-in' ? 'password' : 'newPassword'}
            onSubmitEditing={submit}
            errors={fieldErrors.password}
          />
        )}

        <Notice message={message?.text} tone={message?.tone} />

        <Button title={submitTitle} onPress={submit} loading={busy} />

        {mode === 'sign-in' && <TextLink label="Forgot password?" onPress={() => switchMode('reset')} />}
        {mode === 'reset' && (
          <Row style={styles.links}>
            <TextLink label="Back to sign in" onPress={() => switchMode('sign-in')} />
            {codeSent && <TextLink label="Send new code" onPress={resend} disabled={busy} />}
          </Row>
        )}
      </Card>
    </Screen>
  );
}

function TextLink({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [styles.link, { opacity: pressed || disabled ? 0.6 : 1 }]}>
      <ThemedText type="linkPrimary">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: 'center', paddingVertical: Spacing.one },
  links: { justifyContent: 'space-between' },
  hero: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five },
  tagline: { textAlign: 'center' },
});
