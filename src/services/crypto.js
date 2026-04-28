const crypto = require('crypto');
const ALGO   = 'aes-256-gcm';

function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) throw new Error('ENCRYPTION_KEY debe ser 64 chars hex');
  return Buffer.from(hex, 'hex');
}

function encrypt(text) {
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  let enc      = cipher.update(text, 'utf8', 'hex');
  enc         += cipher.final('hex');
  const tag    = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${enc}:${tag}`;
}

function decrypt(data) {
  const [ivHex, enc, tagHex] = data.split(':');
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let dec  = decipher.update(enc, 'hex', 'utf8');
  dec     += decipher.final('utf8');
  return dec;
}

module.exports = { encrypt, decrypt };
