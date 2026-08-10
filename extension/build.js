import { build } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function buildExtensionAndUserscript() {
  console.log('🚀 Building TypeRacer Extension & Userscript...');

  const outDirExtension = path.resolve(rootDir, 'dist/extension');
  const outDirUserscript = path.resolve(rootDir, 'dist/userscript');

  // Clean dist directories
  fs.mkdirSync(outDirExtension, { recursive: true });
  fs.mkdirSync(path.join(outDirExtension, 'icons'), { recursive: true });
  fs.mkdirSync(outDirUserscript, { recursive: true });

  // 1. Build Extension Content Script
  await build({
    configFile: false,
    build: {
      outDir: outDirExtension,
      emptyOutDir: false,
      lib: {
        entry: path.resolve(__dirname, 'src/content.ts'),
        name: 'TypeRacerContentScript',
        formats: ['iife'],
        fileName: () => 'content.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  });

  // 2. Build Extension Background Worker
  await build({
    configFile: false,
    build: {
      outDir: outDirExtension,
      emptyOutDir: false,
      lib: {
        entry: path.resolve(__dirname, 'src/background.ts'),
        name: 'TypeRacerBackgroundScript',
        formats: ['iife'],
        fileName: () => 'background.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  });

  // 3. Copy Manifest V3
  fs.copyFileSync(
    path.resolve(__dirname, 'manifest.json'),
    path.resolve(outDirExtension, 'manifest.json')
  );

  // Create dummy icon files if not present
  const iconSizes = [16, 48, 128];
  const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#dc2626"/><text x="50" y="65" font-size="50" font-weight="bold" fill="#ffffff" text-anchor="middle">TR</text></svg>`;
  for (const size of iconSizes) {
    fs.writeFileSync(path.resolve(outDirExtension, `icons/icon${size}.png`), svgIcon);
  }

  // 4. Bundle Userscript (.user.js)
  const headerContent = fs.readFileSync(path.resolve(__dirname, 'userscript-header.js'), 'utf-8');
  const compiledContent = fs.readFileSync(path.resolve(outDirExtension, 'content.js'), 'utf-8');

  const userscriptFinal = `${headerContent.trim()}\n\n(function() {\n'use strict';\n${compiledContent}\n})();\n`;
  const userscriptPath = path.resolve(outDirUserscript, 'typeracer-overlay.user.js');

  fs.writeFileSync(userscriptPath, userscriptFinal, 'utf-8');

  console.log(`✅ Chrome Extension generated at: ${outDirExtension}`);
  console.log(`✅ Userscript generated at: ${userscriptPath}`);
}

buildExtensionAndUserscript().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
