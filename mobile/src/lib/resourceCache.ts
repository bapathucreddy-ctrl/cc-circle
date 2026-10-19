// In-memory only: explicitly named resources may survive navigation, never sign-out.
type Entry = { value: unknown; loaded: boolean; at: number; pending?: Promise<unknown>; listeners: Set<() => void> };
const entries = new Map<string, Entry>();
let accountId: string | null = null;
export function scopeResourceCache(nextAccountId: string | null) {
  if (accountId !== nextAccountId) { entries.clear(); accountId = nextAccountId; }
}
export function resourceEntry(key: string): Entry {
  let entry = entries.get(key);
  if (!entry) {
    if (entries.size >= 100) for (const [id, old] of entries) {
      if (!old.listeners.size && !old.pending) { entries.delete(id); break; }
    }
    entry = { value: null, loaded: false, at: 0, listeners: new Set() }; entries.set(key, entry);
  }
  return entry;
}
export function clearResourceCache() { entries.clear(); }
export async function fetchResource<T>(entry: Entry, load: () => Promise<T>): Promise<T> {
  if (entry.pending) return entry.pending as Promise<T>;
  const pending = Promise.resolve().then(load).then(value => {
    entry.value = value; entry.loaded = true; entry.at = Date.now();
    for (const listener of entry.listeners) listener();
    return value;
  });
  entry.pending = pending;
  try { return await pending; } finally { if (entry.pending === pending) entry.pending = undefined; }
}
