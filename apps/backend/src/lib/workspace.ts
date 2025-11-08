import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import logger from './logger';

/**
 * Creates a temporary workspace per request.
 * Structure:
 *   uploads/{requestId}/
 *   outputs/{requestId}/
 * Automatically cleans up when the response finishes.
 */
export function withTempWorkspace(baseUploads: string, baseOutputs: string) {
  return (req: any, res: any, next: any) => {
    const requestId = uuidv4();
    const uploadDir = path.join(baseUploads, requestId);
    const outputDir = path.join(baseOutputs, requestId);

    [uploadDir, outputDir].forEach(dir => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });

    // Attach to request locals
    req.locals = { requestId, uploadDir, outputDir };
    logger.info(`Created temp workspace for request ${requestId}`);

    // Cleanup after response
    res.on('finish', () => {
      try {
        cleanupDir(uploadDir);
        // cleanupDir(outputDir);
        logger.info(`Cleaned up workspace for request ${requestId}`);
      } catch (err: any) {
        logger.error(
          `Failed to cleanup workspace ${requestId}: ${err.message}`
        );
      }
    });

    next();
  };
}

function cleanupDir(dir: string) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}
