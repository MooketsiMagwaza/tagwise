// Live updates and presence between browser tabs, over BroadcastChannel.
// This is real, but local: two tabs (or two windows) of the same browser see
// each other's changes and presence immediately. Across devices it needs the
// backend (server-sent events), which does not exist yet.

export const tabId = Math.random().toString(36).slice(2, 10);

export type LiveMessage =
  | { type: 'db'; from: string }
  | { type: 'presence'; from: string; personId: string; path: string; at: number }
  | { type: 'bye'; from: string };

const channel: BroadcastChannel | null = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('tagwise-live') : null;
const listeners = new Set<(m: LiveMessage) => void>();

channel?.addEventListener('message', (event: MessageEvent<LiveMessage>) => {
  if (!event.data || event.data.from === tabId) return;
  listeners.forEach((l) => l(event.data));
});

export function broadcast(message: LiveMessage) {
  channel?.postMessage(message);
}

export function onLive(listener: (m: LiveMessage) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const liveAvailable = () => channel !== null;
