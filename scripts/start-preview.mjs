import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validatePreviewConfig } from './preview-config.mjs';

const errors = validatePreviewConfig(process.env);
if (errors.length) {
  console.error('Preview configuration is incomplete:\n' + errors.join('\n'));
  process.exit(1);
}
if (process.argv.includes('--check')) {
  console.log('Preview configuration validated.');
} else {
  const child = spawn(
    process.execPath,
    [
      fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url)),
      'start',
      '--hostname',
      '0.0.0.0',
      '--port',
      process.env.PORT ?? '3000',
    ],
    { stdio: 'inherit', env: process.env },
  );
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
  child.on('error', () => {
    console.error('Unable to start preview server.');
    process.exit(1);
  });
  child.on('exit', (code, signal) => process.exit(code ?? (signal === 'SIGTERM' ? 0 : 1)));
}
