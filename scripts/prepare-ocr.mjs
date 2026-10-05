import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('public/ocr', { recursive: true });
for (const file of ['worker.min.js', 'worker.min.js.LICENSE.txt'])
  await copyFile(`node_modules/tesseract.js/dist/${file}`, `public/ocr/${file}`);
for (const file of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'LICENSE'])
  await copyFile(`node_modules/tesseract.js-core/${file}`, `public/ocr/${file}`);
