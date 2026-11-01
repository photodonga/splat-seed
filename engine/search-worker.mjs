// Module Web Worker: runs OffsetSearch in chunks, reports progress, supports cancel.
import { OffsetSearch, makeContext, initialState } from './shellout.mjs';

let job = null;

function tick() {
  if (!job) return;
  const t0 = performance.now();
  // keep each slice ~30 ms so cancel messages are handled promptly
  while (!job.search.done && performance.now() - t0 < 30) job.search.step(4096);
  if (job.search.done) {
    postMessage({ type: 'done', id: job.id, result: job.search.result(), ms: performance.now() - job.started });
    job = null;
    return;
  }
  postMessage({ type: 'progress', id: job.id, progress: job.search.progress, found: job.search.candidates.length });
  setTimeout(tick, 0);
}

onmessage = ({ data }) => {
  if (data.type === 'cancel') {
    if (job) postMessage({ type: 'cancelled', id: job.id, searched: job.search.offset });
    job = null;
    return;
  }
  if (data.type === 'start') {
    try {
      const p = data.params;
      const startState = p.startState ?? initialState(p.nplnUserId, p.mode);
      const context = makeContext(p.context);
      job = {
        id: data.id,
        started: performance.now(),
        search: new OffsetSearch({ startState, observations: p.observations, context, maxOffset: p.maxOffset, maxCandidates: p.maxCandidates ?? 64 }),
      };
      tick();
    } catch (err) {
      postMessage({ type: 'error', id: data.id, message: String(err && err.message || err) });
    }
  }
};
