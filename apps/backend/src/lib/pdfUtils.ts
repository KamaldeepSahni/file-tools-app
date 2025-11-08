import fs from 'fs';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import logger from './logger';

export async function imagesToPdfBuffer(
  imageFiles: Express.Multer.File[],
  options: { jpegQuality?: number } = {}
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const jpegQuality = options.jpegQuality ?? 90;

  logger.info(
    `Starting image-to-pdf for ${imageFiles.length} images (quality=${jpegQuality})`
  );

  for (const f of imageFiles) {
    const imgBuffer = fs.readFileSync(f.path);
    const converted = await sharp(imgBuffer)
      .jpeg({ quality: jpegQuality })
      .toBuffer();

    let embedded;
    try {
      embedded = await pdfDoc.embedJpg(converted);
    } catch {
      embedded = await pdfDoc.embedPng(converted);
    }

    const { width, height } = embedded.size();
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(embedded, { x: 0, y: 0, width, height });
  }

  const pdfBytes = await pdfDoc.save();
  logger.info(
    `Image-to-PDF complete (${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB)`
  );
  return pdfBytes;
}

export async function splitPdfBuffer(
  pdfBuffer: Buffer,
  maxChunkBytes = 7 * 1024 * 1024
): Promise<Uint8Array[]> {
  const src = await PDFDocument.load(pdfBuffer);
  const total = src.getPageCount();
  const chunks: Uint8Array[] = [];
  let currentPages: number[] = [];

  logger.info(
    `Splitting PDF (${total} pages, ${(pdfBuffer.length / 1024 / 1024).toFixed(
      2
    )} MB)`
  );

  for (let i = 0; i < total; i++) {
    currentPages.push(i);
    const temp = await PDFDocument.create();
    const pages = await temp.copyPages(src, currentPages);
    pages.forEach(p => temp.addPage(p));
    const tmpBuf = await temp.save();

    if (tmpBuf.length >= maxChunkBytes || i === total - 1) {
      const outDoc = await PDFDocument.create();
      const pages2 = await outDoc.copyPages(src, currentPages);
      pages2.forEach(p => outDoc.addPage(p));
      const outBuf = await outDoc.save();
      chunks.push(outBuf);
      logger.info(
        `Chunk #${chunks.length} — ${(outBuf.length / 1024 / 1024).toFixed(
          2
        )} MB`
      );
      currentPages = [];
    }
  }

  return chunks;
}

export async function recompressPdfBuffer(
  pdfBuffer: Buffer,
  options: { jpegQuality?: number } = {},
  originalImagesBuffers?: Buffer[]
): Promise<Uint8Array> {
  const jpegQuality = options.jpegQuality ?? 65;

  if (originalImagesBuffers?.length) {
    const pdfDoc = await PDFDocument.create();
    for (const buf of originalImagesBuffers) {
      const converted = await sharp(buf)
        .jpeg({ quality: jpegQuality })
        .toBuffer();
      const embedded = await pdfDoc.embedJpg(converted);
      const { width, height } = embedded.size();
      const page = pdfDoc.addPage([width, height]);
      page.drawImage(embedded, { x: 0, y: 0, width, height });
    }
    logger.info(`Recompressed PDF with original images (q=${jpegQuality})`);
    return pdfDoc.save();
  }

  const doc = await PDFDocument.load(pdfBuffer);
  const out = await PDFDocument.create();
  const total = doc.getPageCount();
  for (let i = 0; i < total; i++) {
    const [copied] = await out.copyPages(doc, [i]);
    out.addPage(copied);
  }
  logger.info(`Recompressed PDF by rewrite (${total} pages)`);
  return out.save();
}

export async function mergePdfBuffers(buffers: Buffer[]): Promise<Uint8Array> {
  if (!buffers || buffers.length === 0) {
    throw new Error('No PDF buffers provided.');
  }

  const out = await PDFDocument.create();

  for (let i = 0; i < buffers.length; i++) {
    const src = await PDFDocument.load(buffers[i], { ignoreEncryption: false });
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach(p => out.addPage(p));
  }

  return await out.save();
}

declare module 'pdf-lib' {
  interface LoadOptions {
    password?: string;
  }
}

export async function removePdfPassword(
  input: Buffer,
  password: string
): Promise<Uint8Array> {
  if (!password) throw new Error('Password is required.');
  // Throws if password is wrong
  const doc = await PDFDocument.load(input, { password });
  return await doc.save(); // saved without encryption
}

export async function reorderPdfPages(
  input: Buffer,
  order: number[]
): Promise<Uint8Array> {
  const src = await PDFDocument.load(input, { ignoreEncryption: false });
  const out = await PDFDocument.create();

  const pageCount = src.getPageCount();
  if (!order || order.length === 0) throw new Error('Order array is empty.');
  // Validate indices
  for (const idx of order) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= pageCount) {
      throw new Error(`Invalid page index in order: ${idx}`);
    }
  }

  const pages = await out.copyPages(src, order);
  pages.forEach(p => out.addPage(p));

  return await out.save();
}
