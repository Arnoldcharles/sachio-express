const fs = require('fs');
const path = require('path');

const b64 = process.env.GOOGLE_SERVICES_JSON_BASE64;
if (!b64) {
  console.warn('GOOGLE_SERVICES_JSON_BASE64 is not set; skipping google-services.json write.');
  process.exit(0);
}

const outputPath = path.join(__dirname, '..', 'google-services.json');
try {
  const buf = Buffer.from(b64, 'base64');
  fs.writeFileSync(outputPath, buf);
  console.log('google-services.json written to', outputPath);
} catch (err) {
  console.error('Failed to write google-services.json:', err);
  process.exit(1);
}