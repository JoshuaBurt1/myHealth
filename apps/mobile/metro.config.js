const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch the entire monorepo
config.watchFolders = [workspaceRoot];

// 2. Explicitly map the @my-health/shared alias to the physical folder
config.resolver.extraNodeModules = {
  '@my-health/shared': path.resolve(workspaceRoot, 'packages/shared'),
};

// 3. Make sure Metro looks in root node_modules for dependencies of @my-health/shared
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;