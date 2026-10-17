import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { dataEvents } from '@/services/events';

/**
 * Loads data for a screen whenever it gains focus, whenever `fetcher`
 * changes identity (memoize it on its inputs), and whenever app data
 * changes. Stale responses are dropped; state is only set from promise
 * callbacks.
 */
export function useScreenData<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const requestRef = useRef(0);
  const mountedRef = useRef(true);
  const focusedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(() => {
    const id = ++requestRef.current;
    const current = () => mountedRef.current && id === requestRef.current;
    fetcher()
      .then((result) => {
        if (!current()) return;
        setData(result);
        setError(null);
      })
      .catch((err) => {
        if (!current()) return;
        console.error('[useScreenData] load failed:', err);
        setError(err instanceof Error ? err.message : 'Could not load data');
      })
      .finally(() => {
        if (!current()) return;
        setRefreshing(false);
      });
  }, [fetcher]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      load();
      return () => {
        focusedRef.current = false;
      };
    }, [load])
  );

  // Reload immediately when visible; otherwise reload on next focus.
  useEffect(
    () =>
      dataEvents.subscribe(() => {
        if (focusedRef.current) load();
        // Unfocused screens reload on their next focus anyway.
      }),
    [load]
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  return { data, error, refreshing, refresh, reload: load, loading: data === null && error === null };
}
