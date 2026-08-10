import { codeHash, freshState, mergeState, normalizeState } from '../lib/sync-core.mjs';

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const today = () => new Date().toISOString().slice(0, 10);

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: '同步服务尚未配置数据库。' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: '请求格式无效。' }, 400); }
  const code = String(body.code || '').trim();
  if (code.length < 8) return json({ error: '家庭同步码至少需要 8 位。' }, 400);

  const hash = await codeHash(code);
  const operation = body.operation || 'read';
  const date = String(body.date || today());
  const row = await env.DB.prepare('SELECT state_json, revision FROM family_sync WHERE code_hash = ?').bind(hash).first();

  if (!row) {
    if (operation !== 'create') return json({ error: '未找到该家庭同步记录，请先在另一台设备创建。' }, 404);
    const state = normalizeState(body.state, date);
    await env.DB.prepare('INSERT INTO family_sync (code_hash, state_json, revision, updated_at) VALUES (?, ?, 1, datetime(\'now\'))')
      .bind(hash, JSON.stringify(state)).run();
    return json({ state, revision: 1, created: true });
  }

  const serverState = normalizeState(JSON.parse(row.state_json), date);
  if (operation === 'create') return json({ error: '该同步码已经存在，请在另一台设备选择“加入并下载云端记录”。' }, 409);
  if (operation === 'read' || operation === 'join') return json({ state: serverState, revision: row.revision });
  const nextState = operation === 'reset' ? freshState(date) : mergeState(serverState, body.state, date);
  const result = await env.DB.prepare('UPDATE family_sync SET state_json = ?, revision = revision + 1, updated_at = datetime(\'now\') WHERE code_hash = ? AND revision = ?')
    .bind(JSON.stringify(nextState), hash, row.revision).run();
  if (!result.meta.changes) return json({ error: '同步冲突，请重试。', state: serverState, revision: row.revision }, 409);
  return json({ state: nextState, revision: row.revision + 1 });
}
