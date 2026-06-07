/* generate-ssl.js */

const selfsigned = require('selfsigned');
const fs = require('fs');
const path = require('path');

const sslDir = path.join(__dirname, 'ssl');

// Ensure ssl directory exists
if (!fs.existsSync(sslDir)) {
  fs.mkdirSync(sslDir, { recursive: true });
}

console.log('Generating self-signed SSL certificate for Local PWA testing...');

// Define attributes (use computer name/localhost/local IP)
const attrs = [
  { name: 'commonName', value: 'localhost' },
  { name: 'countryName', value: 'MY' },
  { name: 'localityName', value: 'Kuala Lumpur' },
  { name: 'organizationName', value: 'TerminalBudget PWA' }
];

async function run() {
  try {
    // Generate key and certificate asynchronously
    const pems = await selfsigned.generate(attrs, {
      days: 365,
      keySize: 2048,
      algorithm: 'sha256',
      extensions: [
        {
          name: 'subjectAltName',
          altNames: [
            { type: 2, value: 'localhost' },
            { type: 7, value: '127.0.0.1' }
          ]
        }
      ]
    });

    // Write certificates to disk
    fs.writeFileSync(path.join(sslDir, 'key.pem'), pems.private);
    fs.writeFileSync(path.join(sslDir, 'cert.pem'), pems.cert);

    console.log('SSL Key generated: ssl/key.pem');
    console.log('SSL Cert generated: ssl/cert.pem');
    console.log('Self-signed SSL certificates are successfully generated!');
  } catch (e) {
    console.error('Failed to generate SSL certificate:', e);
  }
}

run();
