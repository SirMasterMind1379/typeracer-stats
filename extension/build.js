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

  // Read version from root package.json
  const pkg = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'package.json'), 'utf-8'));

  // 2. Copy and sync Manifest V3 version
  const manifestPath = path.resolve(__dirname, 'manifest.json');
  const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  manifestData.version = pkg.version;
  fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2) + '\n', 'utf-8');
  fs.writeFileSync(path.resolve(outDirExtension, 'manifest.json'), JSON.stringify(manifestData, null, 2) + '\n', 'utf-8');

  // 3. Copy Custom PNG Icon Files
  const iconSizes = [16, 48, 128];
  const customPngPath = path.resolve(__dirname, 'icons/icon.png');
  const customJpgPath = path.resolve(__dirname, 'icons/icon.jpg');

  if (fs.existsSync(customPngPath)) {
    fs.copyFileSync(customPngPath, path.resolve(outDirExtension, 'icons/icon.png'));
    fs.copyFileSync(customPngPath, path.resolve(outDirExtension, 'icon.png'));
    for (const size of iconSizes) {
      const srcFile = path.resolve(__dirname, `icons/icon${size}.png`);
      if (fs.existsSync(srcFile)) {
        fs.copyFileSync(srcFile, path.resolve(outDirExtension, `icons/icon${size}.png`));
      } else {
        fs.copyFileSync(customPngPath, path.resolve(outDirExtension, `icons/icon${size}.png`));
      }
    }
  }

  if (fs.existsSync(customJpgPath)) {
    fs.copyFileSync(customJpgPath, path.resolve(outDirExtension, 'icons/icon.jpg'));
    fs.copyFileSync(customJpgPath, path.resolve(outDirExtension, 'icon.jpg'));
    for (const size of iconSizes) {
      fs.copyFileSync(customJpgPath, path.resolve(outDirExtension, `icons/icon${size}.jpg`));
    }
  }

  // 4. Bundle Userscript (.user.js) with synced version header
  let headerContent = fs.readFileSync(path.resolve(__dirname, 'userscript-header.js'), 'utf-8');
  headerContent = headerContent.replace(/\/\/\s*@version\s+.*/, `// @version      ${pkg.version}`);
  fs.writeFileSync(path.resolve(__dirname, 'userscript-header.js'), headerContent, 'utf-8');

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
