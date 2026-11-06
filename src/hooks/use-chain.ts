import { useCallback, useEffect, useRef, useState } from 'react';
import { DataTypes, Endpoint, fetchData } from '../lib/api';

export type Resource<T> = { data?: T; loading: boolean; error?: string; checkedAt?: number };
export type ChainState = { [K in Endpoint]: Resource<DataTypes[K]> };
const keys: Endpoint[] = ['status', 'core', 'events', 'stats', 'blocks', 'economy', 'settlements'];
const initial = Object.fromEntries(
  [...keys, 'nft'].map((k) => [k, { loading: false }]),
) as ChainState;

export function useChain() {
  const [state, setState] = useState<ChainState>(initial);
  const busy = useRef(new Set<string>());
  const alive = useRef(true);
  const refresh = useCallback(async (selected: Endpoint[] = keys) => {
    await Promise.allSettled(
      selected.map(async (key) => {
        if (busy.current.has(key)) return;
        busy.current.add(key);
        if (alive.current) setState((s) => ({ ...s, [key]: { ...s[key], loading: true } }));
        try {
          const data = await fetchData(key);
          if (alive.current)
            setState((s) => ({ ...s, [key]: { data, loading: false, checkedAt: Date.now() } }));
        } catch (e) {
          if (alive.current)
            setState((s) => ({
              ...s,
              [key]: {
                ...s[key],
                loading: false,
                error: e instanceof Error ? e.message : 'Unable to load data.',
              },
            }));
        } finally {
          busy.current.delete(key);
        }
      }),
    );
  }, []);
  useEffect(() => {
    alive.current = true;
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible')
        void refresh(['status', 'core', 'events', 'blocks', 'economy', 'settlements']);
    }, 30000);
    const statsTimer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh(['stats']);
    }, 120000);
    return () => {
      alive.current = false;
      clearInterval(timer);
      clearInterval(statsTimer);
    };
  }, [refresh]);
  return { state, refresh };
}
