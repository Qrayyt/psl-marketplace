import sharp from 'sharp';
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
