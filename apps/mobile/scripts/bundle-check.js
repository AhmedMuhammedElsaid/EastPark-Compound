// Release-bundle smoke test: exports the Android JS bundle to a temp dir so bundling breaks
// (e.g. a *.test.tsx under src/app/, which expo-router bundles) fail before an EAS build.
// Needs no EAS credentials. `expo export` regenerates the tracked uniwind-types.d.ts, so it is
// restored afterwards when it was clean beforehand.
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const typesFile = 'uniwind-types.d.ts';
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eastpark-bundle-check-'));

function typesAreDirty() {
  try {
    return execSync(`git status --porcelain -- ${typesFile}`, { cwd: root }).toString().trim() !== '';
  } catch {
    return true; // not a git checkout: leave the file alone
  }
}

const wasDirty = typesAreDirty();
const result = spawnSync(
  'npx',
  ['expo', 'export', '--platform', 'android', '--output-dir', outDir],
  { cwd: root, stdio: 'inherit', shell: true, env: { ...process.env, CI: '1' } }
);

if (!wasDirty && typesAreDirty()) {
  spawnSync('git', ['checkout', '--', typesFile], { cwd: root, stdio: 'inherit' });
}
fs.rmSync(outDir, { recursive: true, force: true });
process.exit(result.status ?? 1);
