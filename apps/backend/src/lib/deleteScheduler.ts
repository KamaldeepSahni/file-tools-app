// src/lib/deleteScheduler.ts
import fs from 'fs';
import path from 'path';
import logger from './logger';

type TimerMap = Map<string, NodeJS.Timeout>;

const timers: TimerMap = new Map();

const MARKER_DOWNLOADED = '.downloaded';
const MARKER_CREATED = '.created';

export const IMMEDIATE_DELETE = 0;
export const TEN_MIN = 10 * 60 * 1000;
export const ONE_DAY = 24 * 60 * 60 * 1000;

/** Write/refresh the "created" marker for an output file */
export function markCreated(filePath: string) {
  try {
    fs.writeFileSync(filePath + MARKER_CREATED, Date.now().toString(), 'utf-8');
    logger.info(`Created marker written for ${path.basename(filePath)}`);
  } catch (err: any) {
    logger.warn(
      `Failed to write created marker for ${filePath}: ${err.message}`
    );
  }
}

/** Schedule deletion after a delay (used after successful download) */
export function scheduleDeletion(filePath: string, delayMs: number) {
  clearScheduledDeletion(filePath);

  try {
    fs.writeFileSync(
      filePath + MARKER_DOWNLOADED,
      Date.now().toString(),
      'utf-8'
    );
  } catch (err: any) {
    logger.warn(
      `Failed to write downloaded marker for ${filePath}: ${err.message}`
    );
  }

  const t = setTimeout(() => safeDelete(filePath), delayMs);
  timers.set(filePath, t);
}

export function clearScheduledDeletion(filePath: string) {
  const t = timers.get(filePath);
  if (t) {
    clearTimeout(t);
    timers.delete(filePath);
  }
}

/** Delete file + markers and clean empty folder */
export function safeDelete(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
      logger.info(`Deleted file ${filePath}`);
    }
    const downloaded = filePath + MARKER_DOWNLOADED;
    const created = filePath + MARKER_CREATED;
    if (fs.existsSync(downloaded)) fs.rmSync(downloaded, { force: true });
    if (fs.existsSync(created)) fs.rmSync(created, { force: true });

    // remove empty request folder if any
    const dir = path.dirname(filePath);
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmSync(dir, { force: true, recursive: true });
      logger.info(`Removed empty request folder ${dir}`);
    }
  } catch (err: any) {
    logger.error(`safeDelete failed for ${filePath}: ${err.message}`);
  } finally {
    timers.delete(filePath);
  }
}

/** On startup: restore scheduled deletions and purge expired files */
export function hydrateFromDisk(
  outputsRoot: string,
  downloadDelayMs = TEN_MIN,
  ttlMs = ONE_DAY
) {
  logger.info(`Hydrating deletion scheduler from ${outputsRoot}`);
  if (!fs.existsSync(outputsRoot)) return;

  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile()) {
        if (e.name.endsWith(MARKER_DOWNLOADED)) {
          // restore remaining download timer if file still exists
          const original = full.slice(0, -MARKER_DOWNLOADED.length);
          if (!fs.existsSync(original)) {
            fs.rmSync(full, { force: true });
            continue;
          }
          const ts = parseInt(fs.readFileSync(full, 'utf-8').trim(), 10);
          const remaining = downloadDelayMs - (Date.now() - ts);
          if (remaining <= 0) safeDelete(original);
          else scheduleDeletion(original, remaining);
        }
      }
    }
  };
  walk(outputsRoot);

  // Also do an immediate TTL sweep on startup
  purgeOlderThan(outputsRoot, ttlMs);
}

/** TTL purge for files not downloaded (or regardless) after a day */
export function purgeOlderThan(outputsRoot: string, ttlMs = ONE_DAY) {
  if (!fs.existsSync(outputsRoot)) return;
  const now = Date.now();

  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
        // clean empty dir
        if (fs.existsSync(full) && fs.readdirSync(full).length === 0) {
          fs.rmSync(full, { force: true, recursive: true });
          logger.info(`TTL: removed empty folder ${full}`);
        }
      } else if (e.isFile()) {
        if (
          e.name.endsWith(MARKER_CREATED) ||
          e.name.endsWith(MARKER_DOWNLOADED)
        )
          continue;
        const createdMarker = full + MARKER_CREATED;
        let createdAt = 0;

        if (fs.existsSync(createdMarker)) {
          const ts = parseInt(
            fs.readFileSync(createdMarker, 'utf-8').trim(),
            10
          );
          createdAt = Number.isFinite(ts) ? ts : 0;
        } else {
          // fall back to file mtime if no marker
          const st = fs.statSync(full);
          createdAt = st.mtimeMs || st.ctimeMs || now;
        }

        if (now - createdAt >= ttlMs) {
          logger.info(
            `TTL: deleting ${full} (age ${(now - createdAt) / 1000}s)`
          );
          safeDelete(full);
        }
      }
    }
  };

  walk(outputsRoot);
}

/** Start a daily TTL purge loop (runs every hour) */
export function startTtlLoop(outputsRoot: string, ttlMs = ONE_DAY) {
  setInterval(() => purgeOlderThan(outputsRoot, ttlMs), 60 * 60 * 1000); // hourly
}
