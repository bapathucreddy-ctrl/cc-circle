const fs = require('node:fs');
const path = require('node:path');
const tls = require('node:tls');
const folder = path.resolve(__dirname, '../.local-build');
fs.mkdirSync(folder, { recursive: true });
const certificates = tls.getCACertificates('system');
if (!certificates.length) throw new Error('No system trust certificates are available.');
fs.writeFileSync(path.join(folder, 'system-ca.pem'), certificates.join('\n'));
process.stdout.write(`Exported ${certificates.length} public system trust certificates.\n`);
