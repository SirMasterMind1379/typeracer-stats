import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function buildExtensionAndUserscript() {
  console.log('🚀 Building TypeRacer Extension & Userscript with esbuild...');

  const outDirExtension = path.resolve(rootDir, 'dist/extension');
  const outDirUserscript = path.resolve(rootDir, 'dist/userscript');

  fs.mkdirSync(outDirExtension, { recursive: true });
  fs.mkdirSync(path.join(outDirExtension, 'icons'), { recursive: true });
  fs.mkdirSync(outDirUserscript, { recursive: true });

  // 1. Bundle Content Script and Background Worker using esbuild
  await build({
    entryPoints: [
      path.resolve(__dirname, 'src/content.ts'),
      path.resolve(__dirname, 'src/background.ts'),
    ],
    outdir: outDirExtension,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    loader: {
      '.css': 'text',
      '.ts': 'ts',
    },
    minify: false,
  });

  // 2. Copy Manifest V3
  fs.copyFileSync(
    path.resolve(__dirname, 'manifest.json'),
    path.resolve(outDirExtension, 'manifest.json')
  );

  // 3. Copy Custom Icon Files (.jpg)
  const iconSizes = [16, 48, 128];
  const customIconPath = path.resolve(__dirname, 'icons/icon.jpg');
  if (fs.existsSync(customIconPath)) {
    for (const size of iconSizes) {
      fs.copyFileSync(customIconPath, path.resolve(outDirExtension, `icons/icon${size}.jpg`));
    }
  } else {
    const pngBase64 = 'iVBORw0KGgoAAAANSU5EUgAAABAAAAAQCAYAAAAf8/9hAAAAMklEQVR42mP8z8BQDwAmdAX8//8z/gczw/8w/A+m4eNnGA1DAIZRMAoGAWjA0cQFAgDDAwEAE8hN3wAAAABJRU5ErkJggg==';
    const pngBuffer = Buffer.from(pngBase64, 'base64');
    for (const size of iconSizes) {
      fs.writeFileSync(path.resolve(outDirExtension, `icons/icon${size}.jpg`), pngBuffer);
    }
  }

  // 4. Bundle Userscript (.user.js)
  const headerContent = fs.readFileSync(path.resolve(__dirname, 'userscript-header.js'), 'utf-8');
  const compiledContent = fs.readFileSync(path.resolve(outDirExtension, 'content.js'), 'utf-8');

  const userscriptFinal = `${headerContent.trim()}\n\n${compiledContent}\n`;
  const userscriptPath = path.resolve(outDirUserscript, 'typeracer-overlay.user.js');

  fs.writeFileSync(userscriptPath, userscriptFinal, 'utf-8');

  console.log(`✅ Chrome Extension generated at: ${outDirExtension}`);
  console.log(`✅ Userscript generated at: ${outDirUserscript}`);
}

buildExtensionAndUserscript().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
