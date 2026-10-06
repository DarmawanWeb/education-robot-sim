// Copies Blockly's sprites and cursors into public/ so the workspace never depends on
// Google's demo CDN (kiosks and classrooms often run on restricted networks).
import { cpSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const source = path.join(path.dirname(require.resolve('blockly')), 'media');
const target = path.join(process.cwd(), 'public', 'blockly-media');

mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true, filter: (file) => !/\.(mp3|ogg|wav)$/.test(file) });
process.stdout.write(`blockly media copied to ${path.relative(process.cwd(), target)}\n`);
