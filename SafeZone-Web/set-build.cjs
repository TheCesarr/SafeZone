const fs = require('fs');
const path = require('path');

const type = process.argv[2] || 'client';
const secret = type === 'admin' ? "SAFEZONE_ADMIN_V2_SECRET_KEY_99887766" : "";

const content = `module.exports = {
  type: '${type}',
  adminSecret: '${secret}'
};`;

const targetPath = path.join(__dirname, 'electron/build_config.cjs');
fs.writeFileSync(targetPath, content);
console.log(`[Build Setup] Configured for: ${type} (Secret: ${secret ? 'YES' : 'NO'})`);
