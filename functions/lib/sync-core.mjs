export const DEFAULT_SETTINGS = { newCount: 5, reviewCount: 5 };

export function freshState(date) {
  return { version: 3, days: {}, memory: {}, settings: { ...DEFAULT_SETTINGS }, startedAt: date };
}

export function normalizeState(value, date) {
  const state = value && typeof value === 'object' ? structuredClone(value) : freshState(date);
  state.version = 3;
  state.days = state.days && typeof state.days === 'object' ? state.days : {};
  state.memory = state.memory && typeof state.memory === 'object' ? state.memory : {};
  state.settings = {
    newCount: Math.min(20, Math.max(1, Number(state.settings?.newCount) || 5)),
    reviewCount: Math.min(50, Math.max(0, Number(state.settings?.reviewCount) || 5))
  };
  state.startedAt = state.startedAt || date;
  return state;
}

const ids = values => [...new Set((values || []).map(Number).filter(Number.isInteger))];

function mergeMemory(current, incoming) {
  if (!current) return incoming;
  if (!incoming) return current;
  if ((incoming.stage || 0) > (current.stage || 0)) return incoming;
  if ((incoming.stage || 0) < (current.stage || 0)) return current;
  return (incoming.lastReviewed || '') >= (current.lastReviewed || '') ? incoming : current;
}

export function mergeState(serverValue, clientValue, date) {
  const server = normalizeState(serverValue, date);
  const client = normalizeState(clientValue, date);
  const merged = normalizeState(server, date);
  merged.startedAt = [server.startedAt, client.startedAt].sort()[0];
  merged.settings = client.settings;

  for (const key of new Set([...Object.keys(server.days), ...Object.keys(client.days)])) {
    const left = server.days[key];
    const right = client.days[key];
    if (!left) { merged.days[key] = right; continue; }
    if (!right) { merged.days[key] = left; continue; }
    const newIds = ids([...left.newIds, ...right.newIds]);
    const reviewIds = ids([...left.reviewIds, ...right.reviewIds]).filter(id => !newIds.includes(id));
    const doneIds = ids([...left.doneIds, ...right.doneIds]).filter(id => newIds.includes(id) || reviewIds.includes(id));
    merged.days[key] = {
      date: key,
      newIds,
      reviewIds,
      doneIds,
      completed: (newIds.length + reviewIds.length) > 0 && doneIds.length >= newIds.length + reviewIds.length
    };
  }

  for (const key of new Set([...Object.keys(server.memory), ...Object.keys(client.memory)])) {
    merged.memory[key] = mergeMemory(server.memory[key], client.memory[key]);
  }
  return merged;
}

export async function codeHash(code) {
  const bytes = new TextEncoder().encode(`starter-dictation-family-v1:${code}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}
