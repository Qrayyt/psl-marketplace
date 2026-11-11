import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { AppError } from '../utils/AppError';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';

interface ProcessedImage {
  filename: string;
  url: string;
}

// Обработка загруженного изображения: ресайз + сжатие
export async function processImage(file: Express.Multer.File): Promise<ProcessedImage> {
  const ext = path.extname(file.filename);
  const basename = path.basename(file.filename, ext);
  const outputFilename = `${basename}.webp`;
  const outputPath = path.resolve(env.upload.dir, outputFilename);

  await sharp(file.path)
    .resize(800, 960, { fit: 'cover', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(outputPath);

  // Удаляем оригинал если он не webp
  if (ext !== '.webp' && file.path !== outputPath) {
    try { fs.unlinkSync(file.path); } catch {}
  }

  return {
    filename: outputFilename,
    url: `/uploads/${outputFilename}`,
  };
}

export async function saveProductCover(buffer: Buffer): Promise<ProcessedImage> {
  const image = sharp(buffer, { limitInputPixels: 40_000_000 });
  const filename = `${randomUUID()}.webp`;
  const output = path.resolve(env.upload.dir, filename);
  let encoded: Buffer;
  try {
    const { format } = await image.metadata();
    if (!format || !['jpeg', 'png', 'webp'].includes(format)) throw new Error('Invalid format');
    encoded = await image.rotate()
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw new AppError('Выберите корректное изображение JPEG, PNG или WebP', 400);
  }
  try {
    await fs.promises.mkdir(path.dirname(output), { recursive: true });
    await fs.promises.writeFile(output, encoded, { flag: 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') await removeProductCover(filename);
    throw error;
  }
  return { filename, url: `/uploads/${filename}` };
}

export async function removeProductCover(filename: string) {
  await fs.promises.unlink(path.resolve(env.upload.dir, filename)).catch(error => {
    if (error.code !== 'ENOENT') console.error('Could not remove product cover:', error);
  });
}
