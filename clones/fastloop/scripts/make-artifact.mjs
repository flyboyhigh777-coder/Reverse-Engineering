/**
 * Turns the single-file Vite build into a page the Artifact host can wrap.
 *
 * The host supplies its own <!doctype>, <head> and <body>, so the published
 * file must contain only the inner head (fonts, styles) and inner body
 * (mount point, bundle). It also pads :root with the phone's safe-area
 * insets, which the stylesheet's max() gutters rely on.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'dist/index.html');
const target = resolve(root, 'artifact/index.html');

const html = await readFile(source, 'utf8');

const section = (tag) => {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  if (!match) throw new Error(`В сборке не найден <${tag}>: ${source}`);
  return match[1];
};

const head = section('head')
  .replace(/<meta\s+charset[^>]*>/gi, '')
  .replace(/<meta\s+name=["']viewport["'][^>]*>/gi, '')
  .replace(/<title>[\s\S]*?<\/title>/gi, '')
  .trim();

const body = section('body').trim();

const page = `<title>FastLoop</title>
<meta name="claude:viewport-fit-sides" content="cover">
${head}
${body}
`;

await mkdir(dirname(target), { recursive: true });
await writeFile(target, page, 'utf8');
console.log(`artifact/index.html — ${(Buffer.byteLength(page) / 1024).toFixed(0)} КБ`);
