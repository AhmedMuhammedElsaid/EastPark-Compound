import fs from "node:fs";
import path from "node:path";

/**
 * Two screens that resolve to the same URL make expo-router pick one of them on a cold
 * start. `(admin)/index` once shadowed `(tabs)/index` on `/`, so its guard sent every
 * signed-out launch to login and the guest landing never showed.
 */
const APP_DIR = path.join(__dirname, "..", "app");

function collectUrls(dir: string, urlParts: string[], out: Map<string, string[]>): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const isGroup = entry.name.startsWith("(") && entry.name.endsWith(")");
      collectUrls(path.join(dir, entry.name), isGroup ? urlParts : [...urlParts, entry.name], out);
      continue;
    }
    if (!/\.tsx?$/.test(entry.name) || entry.name.startsWith("_") || entry.name.startsWith("+"))
      continue;
    const name = entry.name.replace(/\.tsx?$/, "");
    const url = `/${[...urlParts, ...(name === "index" ? [] : [name])].join("/")}`;
    const file = path.relative(APP_DIR, path.join(dir, entry.name)).replace(/\\/g, "/");
    out.set(url, [...(out.get(url) ?? []), file]);
  }
}

// Existing pair: merchant screens are always opened through the explicit `/(merchant)/...`
// group path, so the shared URL is harmless. Any NEW collision fails this test.
const KNOWN_COLLISIONS = ["/orders", "/orders/[orderId]"];

describe("expo-router URL collisions", () => {
  it("adds no new screens that share a URL", () => {
    const urls = new Map<string, string[]>();
    collectUrls(APP_DIR, [], urls);
    const collisions = [...urls.entries()].filter(([, files]) => files.length > 1).map(([url]) => url);
    expect(collisions.sort()).toEqual([...KNOWN_COLLISIONS].sort());
  });

  it("serves the Home tab on /", () => {
    const urls = new Map<string, string[]>();
    collectUrls(APP_DIR, [], urls);
    expect(urls.get("/")).toEqual(["(tabs)/index.tsx"]);
  });
});
