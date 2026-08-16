import { codeHash, freshState, mergeState, normalizeState, verifiesImport } from '../lib/sync-core.mjs';

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const today = () => new Date().toISOString().slice(0, 10);

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: '同步服务尚未配置数据库。' }, 503);
  let body;
  try {
    if ((request.headers.get('content-type') || '').includes('application/x-www-form-urlencoded')) {
      const payload = new URLSearchParams(await request.text()).get('payload');
      body = JSON.parse(payload || '');
    } else {
      body = await request.json();
    }
  } catch { return json({ error: '请求格式无效。' }, 400); }
  const code = String(body.code || '').trim();
  if (code.length < 8) return json({ error: '家庭同步码至少需要 8 位。' }, 400);

  const hash = await codeHash(code);
  const operation = body.operation || 'read';
  const date = String(body.date || today());
  const deviceId = String(body.deviceId || 'unknown').slice(0, 100);
  const row = await env.DB.prepare('SELECT state_json, revision FROM family_sync WHERE code_hash = ?').bind(hash).first();

  const backup = async (reason) => {
    const original = normalizeState(body.state, date);
    await env.DB.prepare('INSERT INTO family_sync_backups (code_hash, device_id, reason, state_json) VALUES (?, ?, ?, ?)')
      .bind(hash, deviceId, reason, JSON.stringify(original)).run();
  };

  if (!row) {
    if (operation !== 'create') return json({ error: '未找到该家庭同步记录，请先在另一台设备创建。' }, 404);
    const state = normalizeState(body.state, date);
    await backup('create');
    await env.DB.prepare('INSERT INTO family_sync (code_hash, state_json, revision, updated_at) VALUES (?, ?, 1, datetime(\'now\'))')
      .bind(hash, JSON.stringify(state)).run();
    return json({ state, revision: 1, created: true, backupComplete: true, importVerified: true });
  }

  const serverState = normalizeState(JSON.parse(row.state_json), date);
  const clientState = normalizeState(body.state, date);
  const staleGenerationRecovered = serverState.sync.generation > clientState.sync.generation;
  if (operation === 'read') return json({ state: serverState, revision: row.revision });
  const importsLocalState = operation === 'create' || operation === 'join' || operation === 'import';
  if (importsLocalState) await backup(operation === 'create' ? 'recreate' : operation);
  const nextState = operation === 'reset'
    ? freshState(date, serverState.sync.generation + 1)
    : mergeState(serverState, body.state, date);
  if (operation === 'reset') {
    const resetAt = new Date().toISOString();
    nextState.sync.settingsUpdatedAt = resetAt;
    if (clientState.sync.previewClock) {
      nextState.sync.previewClock = { offset: clientState.sync.previewClock.offset, updatedAt: resetAt };
    }
  }
  const result = await env.DB.prepare('UPDATE family_sync SET state_json = ?, revision = revision + 1, updated_at = datetime(\'now\') WHERE code_hash = ? AND revision = ?')
    .bind(JSON.stringify(nextState), hash, row.revision).run();
  if (!result.meta.changes) return json({ error: '同步冲突，请重试。', state: serverState, revision: row.revision }, 409);
  return json({
    state: nextState,
    revision: row.revision + 1,
    created: operation === 'create' ? false : undefined,
    backupComplete: importsLocalState,
    importVerified: importsLocalState ? verifiesImport(serverState, clientState, nextState, date) : undefined,
    staleGenerationRecovered: importsLocalState ? staleGenerationRecovered : undefined
  });
}
