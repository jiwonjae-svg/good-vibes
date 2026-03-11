const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts = [...(config.resolver.assetExts ?? []), 'png', 'jpg', 'jpeg', 'gif', 'webp', 'ttf', 'otf'];

// Enable package exports resolution for Firebase tree-shaking (modular SDK).
// This allows Metro to pick up individual firebase/* entry points instead of
// bundling the entire library, reducing the JS bundle size.
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
