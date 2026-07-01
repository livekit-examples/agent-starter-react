#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

function packageDir(packageName) {
  try {
    return path.dirname(require.resolve(`${packageName}/package.json`));
  } catch {
    let currentDir = path.dirname(require.resolve(packageName));
    while (currentDir !== path.dirname(currentDir)) {
      if (fs.existsSync(path.join(currentDir, 'package.json'))) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }
    throw new Error(`Unable to locate package directory for ${packageName}`);
  }
}

function copyFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function copyNamedFiles(sourceDir, destinationDir, filenames) {
  for (const filename of filenames) {
    copyFile(path.join(sourceDir, filename), path.join(destinationDir, filename));
  }
}

function syncVadWebAssets() {
  const sourceDir = path.join(packageDir('@ricky0123/vad-web'), 'dist');
  const destinationDir = path.join(publicDir, 'vad-web');

  copyNamedFiles(sourceDir, destinationDir, [
    'silero_vad_v5.onnx',
    'silero_vad_legacy.onnx',
    'vad.worklet.bundle.min.js',
  ]);
}

function syncOnnxRuntimeAssets() {
  const sourceDir = path.join(packageDir('onnxruntime-web'), 'dist');
  const destinationDir = path.join(publicDir, 'onnxruntime-web');

  copyNamedFiles(sourceDir, destinationDir, [
    'ort-wasm-simd-threaded.mjs',
    'ort-wasm-simd-threaded.wasm',
  ]);
}

syncVadWebAssets();
syncOnnxRuntimeAssets();
console.log('Synced local VAD assets into public/.');
