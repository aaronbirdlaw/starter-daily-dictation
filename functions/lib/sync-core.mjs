export const DEFAULT_SETTINGS = { newCount: 5, reviewCount: 5 };

export function freshState(date, generation = 0) {
  return {
    version: 4,
    days: {},
    memory: {},
    settings: { ...DEFAULT_SETTINGS },
    startedAt: date,
    sync: { generation, settingsUpdatedAt: `${date}T00:00:00.000Z` }
  };
}

export function normalizeState(value, date) {
  const state = value && typeof value === 'object' ? structuredClone(value) : freshState(date);
  state.version = 4;
  state.days = state.days && typeof state.days === 'object' ? state.days : {};
  state.memory = state.memory && typeof state.memory === 'object' ? state.memory : {};
  state.settings = {
    newCount: Math.min(20, Math.max(1, Number(state.settings?.newCount) || 5)),
    reviewCount: Math.min(50, Math.max(0, Number(state.settings?.reviewCount) || 5))
  };
  state.startedAt = state.startedAt || date;
  state.sync = state.sync && typeof state.sync === 'object' ? state.sync : {};
  state.sync.generation = Math.max(0, Number(state.sync.generation) || 0);
  state.sync.settingsUpdatedAt = state.sync.settingsUpdatedAt || `${state.startedAt}T00:00:00.000Z`;
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
  if (server.sync.generation !== client.sync.generation) {
    return structuredClone(server.sync.generation > client.sync.generation ? server : client);
  }
  const merged = normalizeState(server, date);
  merged.startedAt = [server.startedAt, client.startedAt].sort()[0];
  const clientSettingsAreNewer = client.sync.settingsUpdatedAt >= server.sync.settingsUpdatedAt;
  merged.settings = structuredClone(clientSettingsAreNewer ? client.settings : server.settings);
  merged.sync.settingsUpdatedAt = clientSettingsAreNewer ? client.sync.settingsUpdatedAt : server.sync.settingsUpdatedAt;

  for (const key of new Set([...Object.keys(server.days), ...Object.keys(client.days)])) {
    const left = server.days[key];
    const right = client.days[key];
    if (!left) { merged.days[key] = right; continue; }
    if (!right) { merged.days[key] = left; continue; }
    const newIds = ids([...(left.newIds || []), ...(right.newIds || [])]);
    const reviewIds = ids([...(left.reviewIds || []), ...(right.reviewIds || [])]).filter(id => !newIds.includes(id));
    const doneIds = ids([...(left.doneIds || []), ...(right.doneIds || [])]).filter(id => newIds.includes(id) || reviewIds.includes(id));
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

export function containsState(targetValue, sourceValue, date) {
  const target = normalizeState(targetValue, date);
  const source = normalizeState(sourceValue, date);
  if (target.sync.generation !== source.sync.generation) return false;
  for (const [day, value] of Object.entries(source.days)) {
    const completed = new Set((target.days[day]?.doneIds || []).map(Number));
    if ((value.doneIds || []).some(id => !completed.has(Number(id)))) return false;
  }
  for (const [id, value] of Object.entries(source.memory)) {
    if (!target.memory[id] || (target.memory[id].stage || 0) < (value.stage || 0)) return false;
  }
  return true;
}

export async function codeHash(code) {
  const bytes = new TextEncoder().encode(`starter-dictation-family-v1:${code}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}
