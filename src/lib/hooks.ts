"use client";
import { useCallback, useEffect, useState } from "react";
import { api, errorInfo, type ErrInfo } from "./client";

export type Loadable<T> = {
  data: T | undefined;
  error: ErrInfo | undefined;
  loading: boolean;
  reload: () => Promise<void>;
  setData: (d: T) => void;
};

type State<T> = { url: string | null; data?: T; error?: ErrInfo };

/** Завантажити JSON з API панелі. url = null → нічого не робити. */
export function useApi<T>(url: string | null): Loadable<T> {
  const [state, setState] = useState<State<T>>({ url: null });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    api<T>(url).then(
      (data) => !cancelled && setState({ url, data }),
      (e) => !cancelled && setState({ url, error: errorInfo(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [url]);

  const reload = useCallback(async () => {
    if (!url) return;
    setRefreshing(true);
    try {
      const data = await api<T>(url);
      setState({ url, data });
    } catch (e) {
      setState((s) => ({ url, data: s.url === url ? s.data : undefined, error: errorInfo(e) }));
    } finally {
      setRefreshing(false);
    }
  }, [url]);

  const setData = useCallback((data: T) => setState({ url, data }), [url]);
  const current = state.url === url;

  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: !!url && (!current || refreshing),
    reload,
    setData,
  };
}
