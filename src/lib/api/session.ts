import { supabase } from '../supabase';
import { ApiError } from './errors';

/** The signed-in user's id, or an 'auth' ApiError if the session is gone. */
export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new ApiError('Please sign in again.', 'auth');
  return id;
}
