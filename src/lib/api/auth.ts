import { supabase } from '../supabase';
import { isValid, validateSignIn, validateSignUp } from '../validation';
import { ApiError, unwrap } from './errors';

// Supabase Auth error codes → friendly messages (and the field they belong to).
const AUTH_ERRORS: Record<string, { message: string; field?: string }> = {
  invalid_credentials: { message: 'Wrong email or password.' },
  user_already_exists: { message: 'An account with this email already exists. Sign in instead.', field: 'email' },
  email_exists: { message: 'An account with this email already exists. Sign in instead.', field: 'email' },
  email_not_confirmed: { message: 'Confirm your email first. Check your inbox for the link.' },
  weak_password: { message: 'Choose a stronger password.', field: 'password' },
  over_request_rate_limit: { message: 'Too many attempts. Wait a minute and try again.' },
  over_email_send_rate_limit: { message: 'Too many emails sent. Wait a few minutes and try again.' },
};

function toAuthError(error: { code?: string; message: string }): ApiError {
  const known = error.code ? AUTH_ERRORS[error.code] : undefined;
  if (!known) return new ApiError(error.message || 'Something went wrong.', 'auth');
  return new ApiError(known.message, 'auth', known.field ? { [known.field]: [known.message] } : {});
}

export async function signIn(email: string, password: string): Promise<void> {
  const errors = validateSignIn({ email, password });
  if (!isValid(errors)) throw ApiError.validation(errors);

  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw toAuthError(error);
}

/** Returns true when Supabase wants the user to confirm their email before signing in. */
export async function signUp(email: string, password: string, displayName: string): Promise<boolean> {
  const errors = validateSignUp({ email, password, displayName });
  if (!isValid(errors)) throw ApiError.validation(errors);

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { display_name: displayName.trim() } }, // read by handle_new_user()
  });
  if (error) throw toAuthError(error);
  return !data.session;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw toAuthError(error);
}

/**
 * Permanently delete my account: profile, settings, weigh-ins and group
 * memberships. Groups I own pass to the member who joined earliest.
 */
export async function deleteMyAccount(): Promise<void> {
  unwrap(await supabase.rpc('delete_my_account'));
  // The account no longer exists server-side; just forget the session here.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
}
