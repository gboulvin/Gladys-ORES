// -----------------------------------------------------------------------------
// Tiny JSON store under /data, the only writable volume of the container (the
// rootfs is read-only). Used to keep the network status baseline across
// restarts. Failures are swallowed by the callers: losing it only means the
// next read seeds a new baseline.
// -----------------------------------------------------------------------------

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const DATA_DIR = process.env.ORES_DATA_DIR ?? '/data';

/**
 * @param {string} name file name, e.g. "network-status.json"
 * @param {string} [dir]
 */
export function createJsonStore(name, dir = DATA_DIR) {
  const path = join(dir, name);
  return {
    async load() {
      try {
        return JSON.parse(await readFile(path, 'utf8'));
      } catch {
        return null;
      }
    },
    async save(data) {
      await mkdir(dir, { recursive: true });
      // Write then rename: a crash never leaves a truncated file behind.
      const tmp = `${path}.tmp`;
      await writeFile(tmp, JSON.stringify(data));
      await rename(tmp, path);
    },
  };
}
