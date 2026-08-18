import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.cache');
const memory = new Map();
const inFlight = new Map();

const fileFor = key => path.join(root, `${crypto.createHash('sha1').update(key).digest('hex')}.json`);

async function readDisk(key) {
  try {
    return JSON.parse(await fs.readFile(fileFor(key), 'utf8'));
  } catch {
    return null;
  }
}

async function writeDisk(key, entry) {
  try {
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(fileFor(key), JSON.stringify({ key, ...entry }), 'utf8');
  } catch (error) {
    console.warn(`[cache] could not persist ${key}:`, error.message);
  }
}

/**
 * Reads `key` from memory, then disk, and only then calls `produce`.
 * Concurrent callers for the same key share one `produce` run so a burst of
 * timeline cards never fans out into a burst of Gemini or Tavily calls.
 */
export async function cached(key, ttlMs, produce) {
  const now = Date.now();
  const hit = memory.get(key) || (await readDisk(key));
  if (hit && (ttlMs === Infinity || now - hit.at < ttlMs)) {
    memory.set(key, hit);
    return hit.value;
  }
  if (inFlight.has(key)) return inFlight.get(key);

  const run = (async () => {
    try {
      const value = await produce();
      const entry = { at: Date.now(), value };
      memory.set(key, entry);
      await writeDisk(key, entry);
      return value;
    } catch (error) {
      // A stale hit beats an error page when an upstream API is down.
      if (hit) {
        console.warn(`[cache] ${key} failed, serving stale copy:`, error.message);
        return hit.value;
      }
      throw error;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, run);
  return run;
}

export async function clearCache() {
  memory.clear();
  try {
    await fs.rm(root, { recursive: true, force: true });
  } catch {
    /* nothing cached yet */
  }
}
