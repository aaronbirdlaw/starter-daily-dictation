export const DEFAULT_SETTINGS = { newCount: 5, reviewCount: 5, learningTrack: 'all', activeBook: 'starter' };
const STARTER_WORD_COUNT = 495;

export function scopedWordId(bookId, id) {
  let a = 2166136261, b = 16777619;
  for (const char of `${bookId}:${id}`) {
    const code = char.charCodeAt(0);
    a = Math.imul(a ^ code, 16777619) >>> 0;
    b = Math.imul(b ^ code, 2246822519) >>> 0;
  }
  return 2 ** 52 + 2 ** 20 + (a & 0x7ffff) * 2 ** 32 + b;
}

export function freshState(date, generation = 0) {
  return {
    version: 4,
    days: {},
    memory: {},
    books: {},
    settings: { ...DEFAULT_SETTINGS },
    startedAt: date,
    sync: { generation, settingsUpdatedAt: `${date}T00:00:00.000Z` }
  };
}

export function normalizeState(value, date) {
  const state = value && typeof value === 'object' ? structuredClone(value) : freshState(date);
  const newCount = Number(state.settings?.newCount);
  const reviewCount = Number(state.settings?.reviewCount);
  const learningTrack = state.settings?.learningTrack;
  state.version = 4;
  state.days = state.days && typeof state.days === 'object' ? state.days : {};
  for (const day of Object.values(state.days)) {
    if (!day || typeof day !== 'object') continue;
    const completed = new Set(ids(day.doneIds));
    day.completedNewIds = ids([...(day.completedNewIds || []), ...ids(day.newIds).filter(id => completed.has(id))]);
    day.completedReviewIds = ids([...(day.completedReviewIds || []), ...ids(day.reviewIds).filter(id => completed.has(id))]);
  }
  state.memory = state.memory && typeof state.memory === 'object' ? state.memory : {};
  const rawBooks = state.books && typeof state.books === 'object' ? state.books : {};
  state.books = {};
  for (const [id, book] of Object.entries(rawBooks)) {
    if (!/^book-[a-z0-9-]{8,80}$/.test(id) || !book || typeof book !== 'object') continue;
    const words = Array.isArray(book.words) ? book.words : [];
    state.books[id] = {
      id,
      name: String(book.name || '新词库').slice(0, 60),
      updatedAt: String(book.updatedAt || ''),
      deletedAt: String(book.deletedAt || ''),
      words: [...new Map(words.filter(item => Number.isSafeInteger(Number(item?.id)) && Number(item.id) >= 0 && typeof item.text === 'string' && item.text.trim()).map(item => [Number(item.id), { id: Number(item.id), text: item.text.trim().slice(0, 120) }])).values()]
    };
  }
  const wordCounts = new Map();
  for (const book of Object.values(state.books)) for (const word of book.words) wordCounts.set(word.id, (wordCounts.get(word.id) || 0) + 1);
  for (const [bookId, book] of Object.entries(state.books)) for (const word of book.words) {
    if (word.id < STARTER_WORD_COUNT || wordCounts.get(word.id) > 1) word.id = scopedWordId(bookId, word.id);
  }
  state.settings = {
    newCount: Number.isFinite(newCount) ? Math.min(20, Math.max(1, newCount)) : 5,
    reviewCount: Number.isFinite(reviewCount) ? Math.min(50, Math.max(0, reviewCount)) : 5,
    learningTrack: learningTrack === 'themes' ? 'themes' : 'all',
    activeBook: state.books[state.settings?.activeBook] && !state.books[state.settings.activeBook].deletedAt ? state.settings.activeBook : 'starter'
  };
  state.startedAt = state.startedAt || date;
  state.sync = state.sync && typeof state.sync === 'object' ? state.sync : {};
  state.sync.generation = Math.max(0, Number(state.sync.generation) || 0);
  state.sync.settingsUpdatedAt = state.sync.settingsUpdatedAt || `${state.startedAt}T00:00:00.000Z`;
  const previewOffset = Number(state.sync.previewClock?.offset);
  if (Number.isFinite(previewOffset) && state.sync.previewClock?.updatedAt) {
    state.sync.previewClock = {
      offset: Math.min(365, Math.max(0, Math.floor(previewOffset))),
      updatedAt: String(state.sync.previewClock.updatedAt)
    };
  } else {
    delete state.sync.previewClock;
  }
  return state;
}

const ids = values => [...new Set((values || []).map(Number).filter(Number.isInteger))];

function mergeMemory(current, incoming) {
  if (!current) return incoming;
  if (!incoming) return current;
  const currentRestart = current.restartedAt || '';
  const incomingRestart = incoming.restartedAt || '';
  if (currentRestart !== incomingRestart) return incomingRestart > currentRestart ? incoming : current;
  if ((incoming.stage || 0) > (current.stage || 0)) return incoming;
  if ((incoming.stage || 0) < (current.stage || 0)) return current;
  return (incoming.lastReviewed || '') >= (current.lastReviewed || '') ? incoming : current;
}

export function mergeBooks(left = {}, right = {}) {
  const merged = structuredClone(left);
  for (const [id, incoming] of Object.entries(right)) {
    const current = merged[id];
    if (!current) { merged[id] = structuredClone(incoming); continue; }
    const names = incoming.updatedAt >= current.updatedAt ? incoming : current;
    const words = new Map(current.words.map(word => [word.id, word]));
    for (const word of incoming.words) if (!words.has(word.id)) words.set(word.id, word);
    merged[id] = {
      ...structuredClone(names),
      words: [...words.values()],
      deletedAt: [current.deletedAt || '', incoming.deletedAt || ''].sort().at(-1)
    };
  }
  return merged;
}

export function mergeState(serverValue, clientValue, date) {
  const server = normalizeState(serverValue, date);
  const client = normalizeState(clientValue, date);
  if (server.sync.generation !== client.sync.generation) {
    return structuredClone(server.sync.generation > client.sync.generation ? server : client);
  }
  const merged = normalizeState(server, date);
  merged.books = mergeBooks(server.books, client.books);
  merged.startedAt = [server.startedAt, client.startedAt].sort()[0];
  const clientSettingsAreNewer = client.sync.settingsUpdatedAt >= server.sync.settingsUpdatedAt;
  merged.settings = structuredClone(clientSettingsAreNewer ? client.settings : server.settings);
  if (merged.books[merged.settings.activeBook]?.deletedAt) merged.settings.activeBook = 'starter';
  merged.sync.settingsUpdatedAt = clientSettingsAreNewer ? client.sync.settingsUpdatedAt : server.sync.settingsUpdatedAt;
  const serverClock = server.sync.previewClock;
  const clientClock = client.sync.previewClock;
  if (serverClock || clientClock) {
    merged.sync.previewClock = structuredClone(
      !serverClock ? clientClock
        : !clientClock ? serverClock
          : clientClock.updatedAt >= serverClock.updatedAt ? clientClock : serverClock
    );
  }

  for (const key of new Set([...Object.keys(server.days), ...Object.keys(client.days)])) {
    const left = server.days[key];
    const right = client.days[key];
    if (!left) { merged.days[key] = right; continue; }
    if (!right) { merged.days[key] = left; continue; }
    const newIds = ids([...(left.newIds || []), ...(right.newIds || [])]);
    const reviewIds = ids([...(left.reviewIds || []), ...(right.reviewIds || [])]).filter(id => !newIds.includes(id));
    const doneIds = ids([...(left.doneIds || []), ...(right.doneIds || [])]).filter(id => newIds.includes(id) || reviewIds.includes(id));
    const notConfidentIds = ids([...(left.notConfidentIds || []), ...(right.notConfidentIds || [])]).filter(id => doneIds.includes(id));
    const completedNewIds = ids([...(left.completedNewIds || []), ...(right.completedNewIds || []), ...newIds.filter(id => doneIds.includes(id))]);
    const completedReviewIds = ids([...(left.completedReviewIds || []), ...(right.completedReviewIds || []), ...reviewIds.filter(id => doneIds.includes(id))]);
    merged.days[key] = {
      date: key,
      extraReview: Math.min(495, Math.max(0, Math.floor(Number(left.extraReview) || 0), Math.floor(Number(right.extraReview) || 0))),
      newIds,
      reviewIds,
      doneIds,
      completedNewIds,
      completedReviewIds,
      notConfidentIds,
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
    const completedNew = new Set(target.days[day]?.completedNewIds || []);
    const completedReview = new Set(target.days[day]?.completedReviewIds || []);
    if (value.completedNewIds.some(id => !completedNew.has(id)) || value.completedReviewIds.some(id => !completedReview.has(id))) return false;
  }
  for (const [id, value] of Object.entries(source.memory)) {
    if (!target.memory[id] || (target.memory[id].stage || 0) < (value.stage || 0)) return false;
  }
  for (const [id, book] of Object.entries(source.books)) {
    const found = target.books[id];
    if (!found || (book.deletedAt && !found.deletedAt) ||
      book.words.some(word => !found.words.some(other => other.id === word.id && other.text === word.text))) return false;
  }
  return true;
}

export function verifiesImport(serverValue, clientValue, targetValue, date) {
  const server = normalizeState(serverValue, date);
  const client = normalizeState(clientValue, date);
  const target = normalizeState(targetValue, date);
  if (server.sync.generation > client.sync.generation) {
    return target.sync.generation === server.sync.generation;
  }
  return containsState(target, client, date);
}

export async function codeHash(code) {
  const bytes = new TextEncoder().encode(`starter-dictation-family-v1:${code}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

