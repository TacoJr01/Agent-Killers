import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const runtime = await fs.mkdtemp(path.join(os.tmpdir(), 'ak-queue-'));
process.env.AK_RUNTIME_ROOT = runtime;
const { writeResultArtifact, RESULTS_DIR } = await import('../src/core.js');
const { registerTrustedResults, TRUSTED_RESULTS_DIR } = await import('../src/submissions.js');

const exists = f => fs.access(f).then(() => true, () => false);

// A failed write must not make the next, unrelated write a silent no-op.
await fs.mkdir(RESULTS_DIR, { recursive: true });
const stamp = Date.now();
const blocked = path.join(RESULTS_DIR, `result_queue-test-${stamp}-blocked.json`);
const later = path.join(RESULTS_DIR, `result_queue-test-${stamp}-later.json`);
await fs.mkdir(blocked);
try {
  await assert.rejects(writeResultArtifact(blocked, { n: 1 }));
  await writeResultArtifact(later, { n: 2 });
  assert.equal(await exists(later), true, 'write after a failed write was dropped');
} finally {
  await fs.rm(blocked, { recursive: true, force: true });
  await fs.rm(later, { force: true });
}

// Same for trusted results: an invalid id must not swallow the next registration.
await assert.rejects(registerTrustedResults([{ id: '../bad/id', score: 1 }]));
await registerTrustedResults([{ id: `queue-test-${stamp}`, score: 1 }]);
assert.equal(await exists(path.join(TRUSTED_RESULTS_DIR, `queue-test-${stamp}.json`)), true, 'registration after a failed registration was dropped');

await fs.rm(runtime, { recursive: true, force: true });
console.log('QUEUE TESTS OK');
