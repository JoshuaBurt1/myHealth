// apps/mobile/metro.config.js
// @ts-check
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo
// Use a type-cast to 'any' if the read-only error persists in your IDE
// @ts-ignore
config.watchFolders = [workspaceRoot];

if (config.resolver) {
  // 2. Force Metro to resolve modules from both local and workspace root
  // @ts-ignore
  config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ];
}

module.exports = config;