import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

type QueryState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'ready'; data: T; error?: undefined }
  | { status: 'error'; data?: T; error: Error };

/**
 * Loads data whenever the screen comes into focus (e.g. switching tabs), so
 * every tab shows fresh numbers. `key` reloads when it changes (e.g. a route
 * param). Keeps showing the previous data while reloading.
 */
export function useFocusQuery<T>(load: () => Promise<T>, key: string = '') {
  const [state, setState] = useState<QueryState<T>>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      load().then(
        (data) => active && setState({ status: 'ready', data }),
        (error: Error) => active && setState((prev) => ({ status: 'error', data: prev.data, error })),
      );
      return () => {
        active = false;
      };
      // `load` is usually an inline closure; reload on key/nonce, not identity.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, nonce]),
  );

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
