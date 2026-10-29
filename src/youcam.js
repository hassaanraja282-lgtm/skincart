// Thin YouCam API client (Perfect Corp). Docs: https://docs.makeupar.com
// Flow for every AI feature: File API -> PUT upload -> run task -> poll task.
const BASE = process.env.YOUCAM_API_BASE || 'https://yce-api-01.makeupar.com';
const KEY = process.env.YOUCAM_API_KEY || '';

function headers(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra };
  if (KEY) h.Authorization = `Bearer ${KEY}`;
  return h;
}

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok || (data.status && data.status !== 200)) {
    const err = new Error(`YouCam ${method} ${path} failed (${res.status}): ${data.error || data.error_code || text.slice(0, 200)}`);
    err.status = res.status;
    err.code = data.error_code;
    throw err;
  }
  return data;
}

// Upload a Buffer and return a file_id usable by every AI task.
async function uploadImage(buf, contentType = 'image/jpeg', fileName = 'selfie.jpg') {
  const r = await call('POST', '/s2s/v2.0/file', {
    files: [{ content_type: contentType, file_name: fileName, file_size: buf.length }],
  });
  const f = r.data?.files?.[0] || r.files?.[0];
  if (!f) throw new Error('YouCam File API returned no upload slot');
  const req = f.requests[0];
  const put = await fetch(req.url, { method: req.method || 'PUT', headers: req.headers, body: buf });
  if (!put.ok) throw new Error(`Upload to YouCam storage failed (${put.status})`);
  return f.file_id;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Start a task and poll until success/error (no units are charged on error).
async function runTask(feature, payload, { timeoutMs = 90_000, intervalMs = 2500 } = {}) {
  const start = await call('POST', `/s2s/v2.0/task/${feature}`, payload);
  const taskId = start.data?.task_id;
  if (!taskId) throw new Error(`YouCam ${feature}: no task_id`);
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    await sleep(intervalMs);
    const s = await call('GET', `/s2s/v2.0/task/${feature}/${encodeURIComponent(taskId)}`);
    const st = s.data?.task_status;
    if (st === 'success') return s.data.results;
    if (st === 'error') {
      const e = new Error(friendlyEngineError(s.data.error, s.data.error_message));
      e.code = s.data.error;
      throw e;
    }
  }
  throw new Error(`YouCam ${feature} timed out`);
}

function friendlyEngineError(code, msg) {
  const map = {
    error_no_face: 'No face found. Try a well-lit, front-facing selfie.',
    error_pose: 'Please face the camera straight on and try again.',
    error_face_parsing: 'Could not read the face clearly. Try better lighting.',
    exceed_max_filesize: 'That photo is too large. Try a smaller one.',
    error_exceed_max_image_size: 'That photo is too large. Try a smaller one.',
    error_nsfw_content_detected: 'That image cannot be processed.',
  };
  return map[code] || `Analysis failed${code ? ` (${code})` : ''}${msg ? `: ${msg}` : ''}`;
}

const SKIN_ACTIONS = ['acne', 'pore', 'texture', 'wrinkle', 'redness', 'oiliness', 'moisture', 'dark_circle_v2', 'age_spot', 'radiance'];

function src(ref) {
  return ref.fileId ? { src_file_id: ref.fileId } : { src_file_url: ref.url };
}

async function skinAnalysis(ref) {
  const r = await runTask('skin-analysis', {
    ...src(ref),
    dst_actions: SKIN_ACTIONS,
    format: 'json',
    miniserver_args: { enable_mask_overlay: true },
  });
  return r.output || [];
}

async function skinTone(ref) {
  return runTask('skin-tone-analysis', { ...src(ref), face_angle_strictness_level: 'medium' });
}

// effects: array of YouCam makeup effect objects (lip_color, foundation, blush ...)
async function makeupTryOn(ref, effects) {
  const r = await runTask('makeup-vto', { ...src(ref), version: '1.0', effects });
  return r.url;
}

async function credits() {
  const r = await call('GET', '/s2s/v1.0/client/credit');
  return (r.results || []).reduce((s, x) => s + (x.amount || 0), 0);
}

module.exports = { uploadImage, skinAnalysis, skinTone, makeupTryOn, credits, SKIN_ACTIONS };
