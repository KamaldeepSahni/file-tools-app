import ffmpeg from 'fluent-ffmpeg';
import logger from './logger';

export function setFfmpegPathIfProvided(ffmpegPath?: string): void {
  if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
    logger.info(`Custom ffmpeg path set: ${ffmpegPath}`);
  }
}

export function compressVideoFile(
  inputPath: string,
  outputPath: string,
  options: { crf?: number; preset?: string; bitrate?: string } = {}
): Promise<string> {
  const crf = options.crf ?? 28;
  const preset = options.preset ?? 'medium';

  logger.info(`Compressing video (CRF=${crf}, preset=${preset})`);
  if (options.bitrate) {
    logger.info(`Compressing video using target bitrate ${options.bitrate}`);
  }

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputPath);
    if (options.bitrate) {
      cmd.outputOptions([
        '-vcodec libx264',
        `-b:v ${options.bitrate}`,
        '-movflags +faststart',
      ]);
    } else {
      cmd.outputOptions([
        '-vcodec libx264',
        `-crf ${crf}`,
        `-preset ${preset}`,
        '-movflags +faststart',
      ]);
    }
    cmd
      .on('error', err => {
        logger.error(`Video compression failed: ${err.message}`);
        reject(err);
      })
      .on('end', () => {
        logger.info(`Video compression complete: ${outputPath}`);
        resolve(outputPath);
      })
      .save(outputPath);
  });
}

export function compressAudioFile(
  inputPath: string,
  outputPath: string,
  options: { bitrate?: string } = {}
): Promise<string> {
  const targetBitrate = options.bitrate ?? '96k';
  logger.info(`Compressing audio with target bitrate: ${targetBitrate}`);

  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        logger.error(`ffprobe failed: ${err.message}`);
        return reject(err);
      }

      const stream = metadata.streams.find(s => s.codec_type === 'audio');
      const inputBitrate = stream?.bit_rate
        ? parseInt(stream.bit_rate) / 1000
        : 128;
      const actualTarget = Math.min(inputBitrate, parseInt(targetBitrate));

      ffmpeg(inputPath)
        .audioCodec('libmp3lame')
        .audioBitrate(actualTarget)
        .audioFrequency(32000)
        .audioQuality(5)
        .on('error', err2 => {
          logger.error(`Audio compression failed: ${err2.message}`);
          reject(err2);
        })
        .on('end', () => {
          logger.info(`Audio compression complete: ${outputPath}`);
          resolve(outputPath);
        })
        .save(outputPath);
    });
  });
}

