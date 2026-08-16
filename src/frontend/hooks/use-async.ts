"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Minimal async-data hook.
 *
 * Deliberately not TanStack Query: with a synchronous localStorage backend there
 * is no network to cache, dedupe or retry, so a query client would be ceremony
 * with no benefit. When the MySQL repository lands, THIS is the place to swap
 * in TanStack Query — every consumer already destructures
 * `{ data, error, loading, reload }`, which mirrors its shape.
 */
export interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  reload: () => void;
}

interface State<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

export interface AsyncOptions {
  /**
   * Re-run `fn` every N milliseconds and swap the result in silently.
   *
   * "Silently" is the whole point: a poll must not set `loading`, or every
   * consumer that renders a spinner on `loading` flashes it on each tick. It
   * must also not clear `data` when a tick fails — a momentary backend blip
   * would blank a list that is still perfectly good. A failed poll keeps the
   * previous data and waits for the next tick; only the initial load reports an
   * error.
   */
  pollMs?: number;
}

export function useAsync<T>(
  fn: () => Promise<T>,
  deps: React.DependencyList,
  options: AsyncOptions = {},
): AsyncState<T> {
  const { pollMs } = options;
  // A single state object rather than three; the effect then performs exactly
  // one transition per settle instead of a setLoading + setData cascade.
  const [state, setState] = useState<State<T>>({
    data: null,
    error: null,
    loading: true,
  });
  const [nonce, setNonce] = useState(0);

  // Keep the latest fn without making it a dependency — callers pass an inline
  // arrow, which would otherwise re-run the fetch on every render.
  //
  // Assigned in an effect rather than during render, because mutating a ref
  // while rendering is unsafe under concurrent rendering (a render can be
  // discarded). Ordering is sound: effects run in declaration order, so this
  // commits before the fetch effect below on every pass, and useRef(fn) already
  // seeds the correct value for the first one.
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    let cancelled = false;

    fnRef
      .current()
      .then((result) => {
        if (!cancelled) setState({ data: result, error: null, loading: false });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setState({
            data: null,
            error: e instanceof Error ? e : new Error(String(e)),
            loading: false,
          });
        }
      });

    return () => {
      // Guards against a slow response overwriting a newer one.
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  useEffect(() => {
    if (!pollMs) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    // Chained setTimeout rather than setInterval: the next tick is scheduled
    // only after the previous request settles, so a response slower than the
    // interval cannot pile requests up on a backend that is already struggling.
    const tick = () => {
      timer = setTimeout(() => {
        fnRef
          .current()
          .then((result) => {
            // No `loading` transition and no error state — see AsyncOptions.
            if (!cancelled) setState({ data: result, error: null, loading: false });
          })
          .catch(() => {
            // Keep showing the last good data; the next tick may recover.
          })
          .finally(() => {
            if (!cancelled) tick();
          });
      }, pollMs);
    };

    tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, pollMs]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    setNonce((n) => n + 1);
  }, []);

  return { ...state, reload };
}
