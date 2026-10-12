'use client';

import { useMemo, useSyncExternalStore } from 'react';

/** Missions finished in this browser. Nothing leaves the device. */
const KEY = 'taksu-sim:done';
const listeners = new Set<() => void>();

function readRaw(): string {
  try {
    return window.localStorage.getItem(KEY) ?? '[]';
  } catch {
    return '[]';
  }
}

function parse(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function useFinishedMissions(): ReadonlySet<string> {
  const raw = useSyncExternalStore(subscribe, readRaw, () => '[]');
  return useMemo(() => new Set(parse(raw)), [raw]);
}

export function markFinished(id: string): void {
  const done = new Set(parse(readRaw()));
  if (done.has(id)) return;
  done.add(id);
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...done]));
  } catch {
    // Private mode can block storage; the run still counts on screen.
  }
  for (const listener of listeners) listener();
}
