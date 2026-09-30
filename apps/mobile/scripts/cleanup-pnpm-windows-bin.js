const fs = require("node:fs");
const path = require("node:path");

if (process.platform !== "win32") {
  process.exit(0);
}

const root = path.join(process.cwd(), "node_modules");

if (!fs.existsSync(root)) {
  process.exit(0);
}

let removedCount = 0;

function cleanBinDirectory(binDir) {
  const entries = fs.readdirSync(binDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.name.startsWith(".")) {
      continue;
    }

    const entryPath = path.join(binDir, entry.name);

    try {
      fs.rmSync(entryPath, { force: true, recursive: true });
      removedCount += 1;
    }
    catch {
      // Ignore transient filesystem errors in generated dependency folders.
    }
  }
}

function walk(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const entryPath = path.join(directory, entry.name);

    if (entry.name === ".bin") {
      cleanBinDirectory(entryPath);
      continue;
    }

    walk(entryPath);
  }
}

walk(root);

if (removedCount > 0) {
  console.log(`[cleanup-pnpm-windows-bin] Removed ${removedCount} hidden .bin entries.`);
}
