import express, { NextFunction, RequestHandler, Response } from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import logger from './lib/logger';
import {
  imagesToPdfBuffer,
  splitPdfBuffer,
  mergePdfBuffers,
  removePdfPassword,
  reorderPdfPages,
  compressPdfToTargetBuffer,
} from './lib/pdfUtils';
import {
  setFfmpegPathIfProvided,
  compressVideoFile,
  compressAudioFile,
} from './lib/mediaUtils';
import { withTempWorkspace } from './lib/workspace';
import { RequestWithWorkspace } from './types/request-with-workspace';
import {
  markCreated,
  scheduleDeletion,
  hydrateFromDisk,
  startTtlLoop,
  TEN_MIN,
  ONE_DAY,
  IMMEDIATE_DELETE,
} from './lib/deleteScheduler';
import {
  pdfToImages,
  probeDuration,
  splitVideoFile,
  trimVideoFile,
  zipFolder,
  zipSingleFile,
} from './lib/mediaTools';
import { sanitizeFilename } from './lib/filename';
import { renderPdfThumbnails } from './lib/pdfThumbs';

// writeOut helper
function writeOut(dir: string, name: string, data: Buffer) {
  const outPath = path.join(dir, name);
  fs.writeFileSync(outPath, data);
  markCreated(outPath); // ✅ mark created for TTL
  return outPath;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '500mb' }));

const BASE_UPLOAD_DIR = path.join(__dirname, '../uploads');
const BASE_OUTPUT_DIR = path.join(__dirname, '../outputs');
[BASE_UPLOAD_DIR, BASE_OUTPUT_DIR].forEach(
  dir => !fs.existsSync(dir) && fs.mkdirSync(dir, { recursive: true })
);

if (process.env.FFMPEG_PATH) setFfmpegPathIfProvided(process.env.FFMPEG_PATH);

// Health
app.get('/api/health', (_, res) => {
  logger.info('Health check OK');
  res.json({ ok: true });
});

// 🧩 Attach workspace middleware
app.use('/api', withTempWorkspace(BASE_UPLOAD_DIR, BASE_OUTPUT_DIR));

// 🧠 Helper to create multer dynamically per request
function createUpload(req: any) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, req.locals.uploadDir),
    filename: (_req, file, cb) => cb(null, file.originalname),
  });
  return multer({ storage });
}

// ===== ROUTES ===== //

app.post('/api/image-to-pdf', ((
  req: RequestWithWorkspace,
  res: Response,
  _: NextFunction
) => {
  const upload = createUpload(req).array('images', 200);
  upload(req, res, async (err: any) => {
    if (err) {
      logger.error(`Multer error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }

    try {
      const files = req.files as Express.Multer.File[];
      if (!files?.length)
        return res.status(400).json({ error: 'No images uploaded' });

      const customName = (req.body?.filename || '').trim();
      // Base name: either user-provided or first image’s name without extension
      const baseName = customName || path.parse(files[0].originalname).name;

      const maxChunkMB = Number.isFinite(parseFloat(req.body?.maxChunkMB))
        ? parseFloat(req.body.maxChunkMB)
        : 7; // ✅ server default threshold

      logger.info(
        `Request ${req.locals.requestId}: converting ${files.length} images to PDF (${baseName})`
      );

      const pdfBuf = await imagesToPdfBuffer(files);
      const pdfSizeMB = pdfBuf.length / 1024 / 1024;

      if (pdfSizeMB > maxChunkMB) {
        logger.info(
          `PDF exceeds ${maxChunkMB}MB (${pdfSizeMB.toFixed(
            2
          )} MB), splitting...`
        );
        const chunks = await splitPdfBuffer(
          Buffer.from(pdfBuf),
          maxChunkMB * 1024 * 1024
        );
        const results = chunks.map((b, i) => {
          const name = `${baseName}_part${i + 1}.pdf`;
          writeOut(req.locals.outputDir, name, Buffer.from(b));
          return {
            name,
            url: `/outputs/${req.locals.requestId}/${name}`,
            size: b.length,
          };
        });
        return res.json({ split: true, files: results });
      }

      const pdfName = `${baseName}.pdf`;
      writeOut(req.locals.outputDir, pdfName, Buffer.from(pdfBuf));
      res.json({
        split: false,
        file: {
          name: pdfName,
          url: `/outputs/${req.locals.requestId}/${pdfName}`,
          size: pdfBuf.length,
        },
      });
    } catch (e: any) {
      logger.error(`Image→PDF failed: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });
}) as RequestHandler);

app.post('/api/compress/media', ((
  req: RequestWithWorkspace,
  res: Response,
  _: NextFunction
) => {
  const upload = createUpload(req).single('media');
  upload(req, res, async (err: any) => {
    if (err) return res.status(500).json({ error: err.message });
    try {
      const file = req.file as Express.Multer.File;
      if (!file) return res.status(400).json({ error: 'No media uploaded' });

      const ext = path.extname(file.originalname);
      const base = path.parse(file.originalname).name;
      const outBase = `${base}_compressed`;
      const outName = `${outBase}${
        ext === '.mp3' ||
        ext === '.wav' ||
        ext === '.m4a' ||
        ext === '.aac' ||
        ext === '.ogg'
          ? '.mp3'
          : '.mp4'
      }`;
      const outPath = path.join(req.locals.outputDir, outName);

      const maxSizeMB = parseFloat(req.body?.maxSizeMB || '7');
      const duration = await probeDuration(file.path);
      const targetBitrateKbps = Math.floor((maxSizeMB * 8192) / duration);
      const targetBitrate = `${targetBitrateKbps}k`;

      if (['.mp4', '.mov', '.mkv', '.webm', '.avi'].includes(ext)) {
        await compressVideoFile(file.path, outPath, { bitrate: targetBitrate });
      } else if (['.mp3', '.wav', '.m4a', '.aac', '.ogg'].includes(ext)) {
        await compressAudioFile(file.path, outPath, { bitrate: targetBitrate });
      } else {
        logger.warn(`Unsupported media type: ${ext}`);
        return res.status(400).json({ error: 'Unsupported media type' });
      }

      markCreated(outPath);

      const stat = fs.statSync(outPath);
      res.json({
        file: {
          name: outName,
          url: `/outputs/${req.locals.requestId}/${outName}`,
          size: stat.size,
        },
      });
    } catch (e: any) {
      logger.error(`Media compression failed: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });
}) as RequestHandler);

// ===== PDF Compression Route =====
app.post('/api/compress/pdf', ((
  req: RequestWithWorkspace,
  res: Response,
  _: NextFunction
) => {
  const upload = createUpload(req).single('pdf');
  upload(req, res, async (err: any) => {
    if (err) return res.status(500).json({ error: err.message });

    try {
      const file = req.file as Express.Multer.File;
      if (!file) return res.status(400).json({ error: 'No PDF uploaded' });

      const { requestId, outputDir } = req.locals;
      const maxSizeMB = parseFloat(req.body?.maxSizeMB || '7');
      const targetBytes = maxSizeMB * 1024 * 1024;

      const base = sanitizeFilename(path.parse(file.originalname).name);
      const outName = `${base}_compressed.pdf`;
      const outPath = path.join(outputDir, outName);

      const inputBuf = fs.readFileSync(file.path);
      const finalBuf = await compressPdfToTargetBuffer(inputBuf, targetBytes);

      fs.writeFileSync(outPath, Buffer.from(finalBuf));
      markCreated(outPath);

      const stat = fs.statSync(outPath);

      return res.json({
        file: {
          name: outName,
          url: `/outputs/${requestId}/${outName}`,
          size: stat.size,
        },
      });
    } catch (e: any) {
      logger.error(`PDF compression failed: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });
}) as RequestHandler);

app.post('/api/split-pdf', ((
  req: RequestWithWorkspace,
  res: Response,
  _: NextFunction
) => {
  const upload = createUpload(req).single('pdf');
  upload(req, res, async (err: any) => {
    if (err) return res.status(500).json({ error: err.message });
    try {
      const file = req.file as Express.Multer.File;
      if (!file) return res.status(400).json({ error: 'No PDF uploaded' });

      const baseName = path.parse(file.originalname).name;
      const maxChunkMB = Number.isFinite(parseFloat(req.body?.chunkSizeMB))
        ? parseFloat(req.body.chunkSizeMB)
        : 7; // ✅ server default

      const pdfBuffer = fs.readFileSync(file.path);
      const chunks = await splitPdfBuffer(pdfBuffer, maxChunkMB * 1024 * 1024);

      const results = chunks.map((b, i) => {
        const name = `${baseName}_part${i + 1}.pdf`;
        writeOut(req.locals.outputDir, name, Buffer.from(b));
        return {
          name,
          url: `/outputs/${req.locals.requestId}/${name}`,
          size: b.length,
        };
      });

      res.json({ files: results });
    } catch (e: any) {
      logger.error(`Split PDF failed: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });
}) as RequestHandler);

app.post('/api/pdf-to-images', ((
  req: RequestWithWorkspace,
  res: Response,
  _: NextFunction
) => {
  const upload = createUpload(req).single('pdf');
  upload(req, res, async (err: any) => {
    if (err) return res.status(500).json({ error: err.message });
    try {
      const file = req.file as Express.Multer.File;
      if (!file) return res.status(400).json({ error: 'No PDF uploaded' });

      const { outputDir, requestId } = req.locals;
      const baseName = path.parse(file.originalname).name;

      logger.info(`Converting PDF → Images for ${file.originalname}`);

      // Convert to images
      const images = await pdfToImages(file.path, outputDir);
      if (!images.length) throw new Error('No images extracted from PDF');

      // Create a ZIP of all generated images
      const zipName = `${baseName}_images`;
      const zipPath = await zipFolder(outputDir, outputDir, zipName);
      const finalZipPath = path.join(
        req.locals.outputDir,
        `${baseName}_images.zip`
      );
      if (zipPath !== finalZipPath) fs.renameSync(zipPath, finalZipPath);
      markCreated(finalZipPath);

      // ✅ Clean up raw images (keep only zip)
      images.forEach(imgPath => {
        try {
          fs.rmSync(imgPath, { force: true });
        } catch (err: any) {
          logger.warn(`Failed to delete temp image ${imgPath}: ${err.message}`);
        }
      });

      const size = fs.statSync(finalZipPath).size;
      logger.info(
        `PDF→Images complete: ${images.length} images zipped as ${zipName}.zip`
      );

      res.json({
        zip: {
          name: `${zipName}.zip`,
          url: `/outputs/${requestId}/${zipName}.zip`,
          size,
        },
        count: images.length,
      });
    } catch (e: any) {
      logger.error(`PDF→Images failed: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });
}) as RequestHandler);

app.post('/api/split-video', ((
  req: RequestWithWorkspace,
  res: Response,
  _: NextFunction
) => {
  const upload = createUpload(req).single('video');
  upload(req, res, async (err: any) => {
    if (err) return res.status(500).json({ error: err.message });
    try {
      const file = req.file as Express.Multer.File;
      if (!file) return res.status(400).json({ error: 'No video uploaded' });

      const { outputDir, requestId } = req.locals;
      const chunkSize = parseFloat(req.body?.chunkSizeMB || '7');
      const asZip = req.body?.asZip === 'true';

      const chunks = await splitVideoFile(file.path, outputDir, chunkSize);
      const results: { name: string; url: string; size: number }[] = [];

      for (const chunk of chunks) {
        // mark created using writeOut (since the file already exists)
        markCreated(chunk);

        if (asZip) {
          const zipPath = await zipSingleFile(chunk, outputDir);
          const name = path.basename(zipPath);
          results.push({
            name,
            url: `/outputs/${requestId}/${name}`,
            size: fs.statSync(zipPath).size,
          });
        } else {
          const name = path.basename(chunk);
          results.push({
            name,
            url: `/outputs/${requestId}/${name}`,
            size: fs.statSync(chunk).size,
          });
        }
      }

      res.json({ files: results, zipped: asZip });
    } catch (e: any) {
      logger.error(`Video Split failed: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });
}) as RequestHandler);

app.post('/api/convert-to-zip', ((
  req: RequestWithWorkspace,
  res: Response,
  _: NextFunction
) => {
  const upload = createUpload(req).array('files', 50);
  upload(req, res, async (err: any) => {
    if (err) return res.status(500).json({ error: err.message });
    try {
      const files = req.files as Express.Multer.File[];
      if (!files?.length)
        return res.status(400).json({ error: 'No files uploaded' });

      const { outputDir, requestId } = req.locals;
      const results: { name: string; url: string; size: number }[] = [];

      for (const f of files) {
        const zipPath = await zipSingleFile(f.path, outputDir);
        markCreated(zipPath);
        const stat = fs.statSync(zipPath);
        results.push({
          name: path.basename(zipPath),
          url: `/outputs/${requestId}/${path.basename(zipPath)}`,
          size: stat.size,
        });
      }

      res.json({ files: results });
    } catch (e: any) {
      logger.error(`Convert to ZIP failed: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });
}) as RequestHandler);

app.post('/api/pdf/merge', ((
  req: RequestWithWorkspace,
  res: Response,
  _: NextFunction
) => {
  const upload = createUpload(req).array('pdfs', 50);
  upload(req, res, async (err: any) => {
    if (err) {
      logger.error(`Merge PDFs upload error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }

    try {
      const files = (req.files as Express.Multer.File[]) || [];
      if (files.length < 2) {
        return res
          .status(400)
          .json({ error: 'Please upload at least 2 PDF files.' });
      }

      // Basic type check (best-effort)
      const nonPdf = files.find(f => !(f.mimetype || '').includes('pdf'));
      if (nonPdf) {
        logger.warn(
          `Non-PDF detected in merge: ${nonPdf.originalname} (${nonPdf.mimetype})`
        );
      }

      const { requestId, outputDir } = req.locals;
      const customName = (req.body?.filename || '').toString().trim();

      // Default base name: first uploaded file's base (per your choice)
      const firstNameBase = path.parse(files[0].originalname).name;
      const base = sanitizeFilename(customName || firstNameBase || 'merged');
      const outName = `${base}.pdf`;
      const outPath = path.join(outputDir, outName);

      logger.info(
        `[merge-pdf] start: req=${requestId}, files=${files.length}, out=${outName}`
      );

      // Read buffers in given order
      const buffers: Buffer[] = [];
      for (const f of files) {
        const buf = fs.readFileSync(f.path);
        buffers.push(buf);
      }

      const merged = await mergePdfBuffers(buffers);

      // Write output, mark created for TTL
      fs.writeFileSync(outPath, Buffer.from(merged));
      markCreated(outPath);

      const size = fs.statSync(outPath).size;

      logger.info(`[merge-pdf] complete: req=${requestId}, size=${size}B`);

      return res.json({
        file: {
          name: outName,
          url: `/outputs/${requestId}/${outName}`,
          size,
        },
      });
    } catch (e: any) {
      logger.error(`[merge-pdf] failed: ${e.message}`);
      return res
        .status(500)
        .json({ error: e.message || 'Failed to merge PDFs' });
    }
  });
}) as RequestHandler);

app.post('/api/pdf/remove-password', ((
  req: RequestWithWorkspace,
  res: Response,
  _: NextFunction
) => {
  const upload = createUpload(req).single('pdf');
  upload(req, res, async (err: any) => {
    if (err) return res.status(500).json({ error: err.message });
    try {
      const file = req.file as Express.Multer.File;
      const password = (req.body?.password || '').toString();
      if (!file) return res.status(400).json({ error: 'No PDF uploaded' });
      if (!password)
        return res.status(400).json({ error: 'Password is required' });

      const { requestId, outputDir } = req.locals;
      const base = sanitizeFilename(path.parse(file.originalname).name);
      const outName = `${base}_unlocked.pdf`;
      const outPath = path.join(outputDir, outName);

      logger.info(
        `[pdf-unlock] start: req=${requestId}, file=${file.originalname}`
      );
      const unlocked = await removePdfPassword(
        fs.readFileSync(file.path),
        password
      );

      fs.writeFileSync(outPath, Buffer.from(unlocked));
      markCreated(outPath);
      const size = fs.statSync(outPath).size;

      logger.info(`[pdf-unlock] complete: out=${outName}, size=${size}`);
      res.json({
        file: { name: outName, url: `/outputs/${requestId}/${outName}`, size },
      });
    } catch (e: any) {
      logger.error(`[pdf-unlock] failed: ${e.message}`);
      const msg = /Password/i.test(e.message)
        ? 'Incorrect password.'
        : e.message;
      res.status(400).json({ error: msg });
    }
  });
}) as RequestHandler);

app.post('/api/video/trim/init', ((
  req: RequestWithWorkspace,
  res: Response,
  _: NextFunction
) => {
  const upload = createUpload(req).single('video');
  upload(req, res, async (err: any) => {
    if (err) return res.status(500).json({ error: err.message });
    const file = req.file as Express.Multer.File;
    if (!file) return res.status(400).json({ error: 'No video uploaded' });

    const filename = path.parse(file.path).base;
    const { requestId, outputDir } = req.locals;

    try {
      const dur = await probeDuration(file.path);

      logger.info(
        `[video-trim-init] req=${requestId}, file=${file.originalname}, duration=${dur}s`
      );

      writeOut(outputDir, filename, fs.readFileSync(file.path));

      return res.json({ requestId, filename, duration: dur });
    } catch (e: any) {
      logger.error(`[video-trim-init] failed: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });
}) as RequestHandler);

app.post('/api/video/trim/build', async (req, res) => {
  try {
    const { requestId, filename } = req.body;
    const outputDir = path.join(BASE_OUTPUT_DIR, requestId);

    const start = Number((req.body?.start || '').toString());
    const end = Number((req.body?.end || '').toString());
    const reencode = req.body?.reencode === 'true';

    console.log(req.body?.start, req.body?.end);
    console.log(
      `Trim request: start=${start}, end=${end}, reencode=${reencode}`
    );

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return res
        .status(400)
        .json({ error: 'Start and end must be numeric seconds.' });
    }

    const filePath = path.join(outputDir, filename);
    const base = path.parse(filename).name;
    const outName = `${base}_trimmed.mp4`;
    const outPath = path.join(outputDir, outName);

    logger.info(
      `[video-trim-build] start: req=${requestId}, file=${filename}, start=${start}, end=${end}, reencode=${reencode}`
    );

    // Validate range against actual duration
    const dur = await probeDuration(filePath);
    if (start < 0 || end <= 0 || end <= start || start >= dur) {
      return res
        .status(400)
        .json({ error: 'Invalid trim range relative to video duration.' });
    }

    await trimVideoFile(filePath, outPath, { start, end, reencode });

    markCreated(outPath);
    scheduleDeletion(filePath, IMMEDIATE_DELETE); // delete original immediately after trim
    const size = fs.statSync(outPath).size;
    logger.info(`[video-trim-build] complete: out=${outName}, size=${size}`);

    res.json({
      file: { name: outName, url: `/outputs/${requestId}/${outName}`, size },
      duration: dur,
    });
  } catch (e: any) {
    logger.error(`[video-trim-build] failed: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/pdf/reorganize/init', ((
  req: RequestWithWorkspace,
  res: Response,
  _: NextFunction
) => {
  const upload = createUpload(req).single('pdf');
  upload(req, res, async (err: any) => {
    if (err) return res.status(500).json({ error: err.message });
    try {
      const file = req.file as Express.Multer.File;
      if (!file) return res.status(400).json({ error: 'No PDF uploaded' });

      const { requestId, uploadDir, outputDir } = req.locals;

      // Save a clean copy as uploads/<requestId>/original.pdf for later rebuild
      const baseName = path.parse(file.originalname).name;
      const originalPath = path.join(uploadDir, `${baseName}_original.pdf`);
      fs.copyFileSync(file.path, originalPath);

      // Render per-page thumbnails into outputs/<requestId>
      const prefix = 'page_';
      const thumbs = await renderPdfThumbnails(originalPath, outputDir, prefix);

      // Build response entries
      const pages = thumbs.map((abs, i) => ({
        pageIndex: i,
        thumbnail: `/outputs/${requestId}/${path.basename(abs)}`,
      }));

      logger.info(`[pdf-reorg-init] req=${requestId}, pages=${pages.length}`);
      res.json({
        requestId,
        filename: baseName,
        totalPages: pages.length,
        pages,
      });
    } catch (e: any) {
      logger.error(`[pdf-reorg-init] failed: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });
}) as RequestHandler);

app.post('/api/pdf/reorganize/build', async (req, res) => {
  try {
    const requestId: string = (req.body?.requestId || '').toString();
    const order: number[] = req.body?.order;
    const customName: string = (req.body?.filename || '').toString().trim();

    if (!requestId)
      return res.status(400).json({ error: 'requestId is required' });
    if (!Array.isArray(order) || order.length === 0) {
      return res
        .status(400)
        .json({ error: 'order must be a non-empty array of page indices' });
    }

    const outputDir = path.join(BASE_OUTPUT_DIR, requestId);
    const uploadDir = path.join(BASE_UPLOAD_DIR, requestId);
    const originalPath = path.join(uploadDir, 'original.pdf');

    if (!fs.existsSync(originalPath)) {
      return res
        .status(404)
        .json({ error: 'Original PDF not found for this requestId' });
    }

    const base = sanitizeFilename(customName || 'reordered');
    const outName = `${base}.pdf`;
    const outPath = path.join(outputDir, outName);

    logger.info(
      `[pdf-reorg-build] req=${requestId}, pages=${order.length}, out=${outName}`
    );

    const inputBuf = fs.readFileSync(originalPath);
    const outBuf = await reorderPdfPages(inputBuf, order);

    fs.writeFileSync(outPath, Buffer.from(outBuf));
    markCreated(outPath);
    const size = fs.statSync(outPath).size;

    logger.info(`[pdf-reorg-build] complete: out=${outName}, size=${size}`);
    res.json({
      file: { name: outName, url: `/outputs/${requestId}/${outName}`, size },
    });
  } catch (e: any) {
    logger.error(`[pdf-reorg-build] failed: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/outputs/:requestId', (req, res) => {
  const folder = path.join(BASE_OUTPUT_DIR, req.params.requestId);
  if (!fs.existsSync(folder)) return res.json({ files: [] });

  const files = fs
    .readdirSync(folder)
    .filter(f => !f.endsWith('.downloaded'))
    .map(f => {
      const fp = path.join(folder, f);
      const st = fs.statSync(fp);
      const marker = fs.existsSync(fp + '.downloaded')
        ? parseInt(fs.readFileSync(fp + '.downloaded', 'utf8'), 10)
        : null;
      const expiresIn = marker
        ? Math.max(0, marker + 10 * 60_000 - Date.now())
        : null;
      return { name: f, size: st.size, expiresIn };
    });

  res.json({ files });
});

// Force download behavior for /outputs
app.get('/outputs/:requestId/:filename', (req, res) => {
  const { requestId, filename } = req.params;
  const filePath = path.join(BASE_OUTPUT_DIR, requestId, filename);

  if (!fs.existsSync(filePath)) {
    logger.warn(`Download requested for missing file: ${filePath}`);
    return res.status(404).send('File not found');
  }

  const mimeType = mime.lookup(filename) || 'application/octet-stream';
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  // Use res.download for reliable streaming; callback fires after transfer (or error)
  res.download(filePath, filename, err => {
    if (err) {
      logger.error(`Download failed for ${filePath}: ${err.message}`);
      // On error we do not schedule deletion
      if (!res.headersSent) res.status(500).send('Failed to download file');
      return;
    }

    // On successful download: schedule deletion 10 minutes (600000 ms) after this event
    scheduleDeletion(filePath, TEN_MIN);
    logger.info(
      `Scheduled deletion of ${filePath} in ${
        TEN_MIN / 1000
      } seconds (10 minutes)`
    );
  });
});

const PORT = process.env.PORT || 4000;

// hydrate persisted markers so restarts don't leave orphaned files
hydrateFromDisk(BASE_OUTPUT_DIR);
startTtlLoop(BASE_OUTPUT_DIR, ONE_DAY);

app.listen(PORT, () =>
  logger.info(`Server running at http://localhost:${PORT}`)
);

const frontendDist = path.resolve(__dirname, '../../frontend/dist');

app.use(express.static(frontendDist));

app.get('*', (_, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});
