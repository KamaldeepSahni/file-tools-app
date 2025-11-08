import path from 'path';
import fs from 'fs';
import logger from './logger';

// assumes you already use pdf-poppler elsewhere
const poppler = require('pdf-poppler');

/** Generate per-page JPEGs into outputDir with a prefix; returns absolute file paths */
export async function renderPdfThumbnails(
  pdfPath: string,
  outputDir: string,
  prefix: string
): Promise<string[]> {
  const opts = {
    format: 'jpeg',
    out_dir: outputDir,
    out_prefix: prefix,
    page: null,
    // You can add: "scale": 1024 or "jpegFile": true if supported by your pdf-poppler version
  };

  logger.info(
    `Rendering thumbnails for ${path.basename(pdfPath)} → ${outputDir}`
  );
  await poppler.convert(pdfPath, opts);

  const files = fs
    .readdirSync(outputDir)
    .filter(f => f.startsWith(prefix) && f.endsWith('.jpg'))
    .map(f => path.join(outputDir, f))
    .sort();
  return files;
}
