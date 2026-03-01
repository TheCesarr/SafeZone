/**
 * set-build.cjs
 * Sets the build type before electron-builder runs.
 * Usage: node set-build.cjs client   OR   node set-build.cjs admin
 */
const fs = require('fs');
const path = require('path');

const type = process.argv[2] || 'client';

if (type !== 'client' && type !== 'admin') {
  console.error('Usage: node set-build.cjs [client|admin]');
  process.exit(1);
}

// Read secret from environment, not hardcoded
const secret = type === 'admin'
  ? (process.env.ADMIN_SECRET || 'SAFEZONE_ADMIN_V2_SECRET_KEY_99887766')
  : '';

const content = `module.exports = {\n  type: '${type}',\n  adminSecret: '${secret}'\n};\n`;

const targetPath = path.join(__dirname, 'electron/build_config.cjs');
fs.writeFileSync(targetPath, content);
console.log(`[Build Setup] Configured for: ${type} (Secret: ${secret ? 'YES' : 'NO'})`);
