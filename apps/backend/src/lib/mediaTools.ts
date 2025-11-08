import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import archiver from 'archiver';
import logger from './logger';

// ---------- PDF → Images ---------- //
export async function pdfToImages(
  pdfPath: string,
  outputDir: string
): Promise<string[]> {
  const baseName = path.parse(pdfPath).name;
  const outputPattern = path.join(outputDir, baseName);
  const poppler = require('pdf-poppler');

  const opts = {
    format: 'jpeg',
    out_dir: outputDir,
    out_prefix: baseName,
    page: null,
  };

  logger.info(`Converting PDF ${pdfPath} → images`);
  await poppler.convert(pdfPath, opts);

  const images = fs
    .readdirSync(outputDir)
    .filter(f => f.startsWith(baseName) && f.endsWith('.jpg'))
    .map(f => path.join(outputDir, f));
  return images;
}

// ---------- Split Video ---------- //
export async function splitVideoFile(
  inputPath: string,
  outputDir: string,
  chunkSizeMB = 7
): Promise<string[]> {
  const baseName = path.parse(inputPath).name;
  const outputFiles: string[] = [];

  // Step 1: Get duration and size
  const fileStats = fs.statSync(inputPath);
  const fileSizeMB = fileStats.size / (1024 * 1024);

  const totalSeconds: number = await new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      const duration = metadata.format.duration;
      if (!duration) return reject(new Error('Could not determine duration'));
      resolve(duration);
    });
  });

  const totalParts = Math.ceil(fileSizeMB / chunkSizeMB);
  if (totalParts < 2) {
    logger.info('Video smaller than chunk size — no split needed.');
    return [inputPath];
  }

  const secondsPerPart = totalSeconds / totalParts;
  logger.info(
    `Splitting ${baseName}: duration=${totalSeconds.toFixed(
      1
    )}s, size=${fileSizeMB.toFixed(
      2
    )}MB → ${totalParts} parts (~${secondsPerPart.toFixed(1)}s each)`
  );

  // Step 2: Split using time segments
  for (let i = 0; i < totalParts; i++) {
    const startTime = i * secondsPerPart;
    const outputPath = path.join(outputDir, `${baseName}_part${i + 1}.mp4`);

    logger.info(
      `Creating chunk ${i + 1}/${totalParts}: start=${startTime.toFixed(2)}s`
    );

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(secondsPerPart)
        .outputOptions(['-c copy', '-avoid_negative_ts 1'])
        .output(outputPath)
        .on('end', () => {
          logger.info(`Chunk ${i + 1} completed: ${outputPath}`);
          outputFiles.push(outputPath);
          resolve();
        })
        .on('error', err => {
          logger.error(`Chunk ${i + 1} failed: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }

  return outputFiles;
}

// ---------- Zip Folder ---------- //
export async function zipFolder(
  folderPath: string,
  outputDir: string,
  zipName: string
): Promise<string> {
  const zipPath = path.join(outputDir, `${zipName}.zip`);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  const done = new Promise<void>((resolve, reject) => {
    output.on('close', () => resolve());
    archive.on('error', err => reject(err));
  });

  archive.pipe(output);
  archive.directory(folderPath, false);
  archive.finalize();
  await done;

  logger.info(`Zipped folder ${folderPath} → ${zipPath}`);
  return zipPath;
}

// ---------- Convert media to ZIP ---------- //
export async function zipSingleFile(
  filePath: string,
  outputDir: string
): Promise<string> {
  const baseName = path.parse(filePath).name;
  const zipPath = path.join(outputDir, `${baseName}.zip`);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  const done = new Promise<void>((resolve, reject) => {
    output.on('close', () => resolve());
    archive.on('error', err => reject(err));
  });

  archive.pipe(output);
  archive.file(filePath, { name: path.basename(filePath) });
  archive.finalize();
  await done;

  logger.info(`Zipped ${filePath} → ${zipPath}`);
  return zipPath;
}

// ---------- Trim Video ---------- //
export interface TrimOptions {
  start: number; // seconds
  end: number; // seconds
  reencode?: boolean; // default false -> stream copy
}

/** Probe duration in seconds using fluent-ffmpeg */
export function probeDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, meta) => {
      if (err) return reject(err);
      const dur = meta?.format?.duration;
      if (!dur || !Number.isFinite(dur))
        return reject(new Error('Unable to determine duration.'));
      resolve(dur);
    });
  });
}

/** Trim video between start..end into outputPath. Keeps original codec by default. */
export async function trimVideoFile(
  inputPath: string,
  outputPath: string,
  opts: TrimOptions
): Promise<void> {
  const { start, end, reencode = false } = opts;
  const duration = await probeDuration(inputPath);

  if (start < 0 || end <= 0 || end <= start) {
    throw new Error('Invalid trim range.');
  }
  if (start >= duration) throw new Error('Start is beyond video duration.');
  const safeEnd = Math.min(end, duration);
  const cutLen = safeEnd - start;
  if (cutLen <= 0) throw new Error('Trim length must be > 0.');

  logger.info(
    `Trimming video: start=${start}s end=${safeEnd}s length=${cutLen.toFixed(
      3
    )}s`
  );

  await new Promise<void>((resolve, reject) => {
    const cmd = ffmpeg(inputPath).setStartTime(start).setDuration(cutLen);

    if (reencode) {
      cmd
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions(['-preset medium', '-crf 23']);
    } else {
      cmd.outputOptions(['-c copy', '-avoid_negative_ts 1']);
    }

    cmd
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', err => reject(err))
      .run();
  });

  if (!fs.existsSync(outputPath)) {
    throw new Error('Trim failed to produce output.');
  }
  logger.info(`Trim complete: ${path.basename(outputPath)}`);
}
