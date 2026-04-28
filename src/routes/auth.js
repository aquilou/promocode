const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { pool } = require('../db');
const { sendVerificationEmail, sendResetEmail } = require('../services/email');
const requireAuth = require('../middleware/auth');

const router  = express.Router();
const gClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function signJWT(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

async function createToken(userId, type, ms) {
  const raw  = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  await pool.query(
    'INSERT INTO tokens (user_id, token_hash, type, expires_at) VALUES ($1,$2,$3,$4)',
    [userId, hash, type, new Date(Date.now() + ms)]
  );
  return raw;
}

async function consumeToken(raw, type) {
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const { rows } = await pool.query(
    'SELECT * FROM tokens WHERE token_hash=$1 AND type=$2 AND used=false AND expires_at>NOW() LIMIT 1',
    [hash, type]
  );
  if (!rows[0]) return null;
  await pool.query('UPDATE tokens SET used=true WHERE id=$1', [rows[0].id]);
  return rows[0];
}

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });
    if (password.length < 8)  return res.status(400).json({ error: 'Mínimo 8 caracteres' });
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      'INSERT INTO users (email,name,password_hash) VALUES ($1,$2,$3) RETURNING id,email',
      [email.toLowerCase().trim(), name?.trim() || null, hash]
    ).catch(err => {
      if (err.code === '23505') throw Object.assign(new Error('Email ya registrado'), { status: 409 });
      throw err;
    });
    const token = await createToken(rows[0].id, 'verify_email', 24 * 60 * 60 * 1000);
    await sendVerificationEmail(rows[0].email, token).catch(console.warn);
    res.status(201).json({ message: 'Cuenta creada. Revisa tu correo.' });
  } catch (err) { next(err); }
});

router.get('/verify-email', async (req, res, next) => {
  try {
    const row = await consumeToken(req.query.token, 'verify_email');
    if (!row) return res.status(400).json({ error: 'Enlace inválido o expirado' });
    await pool.query('UPDATE users SET email_verified=true WHERE id=$1', [row.user_id]);
    res.json({ message: 'Email verificado. Ya puedes iniciar sesión.' });
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });
    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email.toLowerCase().trim()]);
    const user = rows[0];
    if (!user?.password_hash) return res.status(401).json({ error: 'Credenciales incorrectas' });
    if (!await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ error: 'Credenciales incorrectas' });
    if (!user.email_verified) return res.status(403).json({ error: 'Verifica tu email primero' });
    res.json({ token: signJWT(user.id), user: { id: user.id, email: user.email, name: user.name, plan: user.plan } });
  } catch (err) { next(err); }
});

router.post('/google', async (req, res, next) => {
  try {
    const ticket  = await gClient.verifyIdToken({ idToken: req.body.credential, audience: process.env.GOOGLE_CLIENT_ID });
    const { sub: googleId, email, name } = ticket.getPayload();
    let { rows } = await pool.query('SELECT * FROM users WHERE google_id=$1 OR email=$2 LIMIT 1', [googleId, email]);
    let user = rows[0];
    if (!user) {
      const ins = await pool.query(
        'INSERT INTO users (email,name,google_id,email_verified) VALUES ($1,$2,$3,true) RETURNING *',
        [email, name, googleId]
      );
      user = ins.rows[0];
    } else if (!user.google_id) {
      await pool.query('UPDATE users SET google_id=$1,email_verified=true WHERE id=$2', [googleId, user.id]);
    }
    res.json({ token: signJWT(user.id), user: { id: user.id, email: user.email, name: user.name, plan: user.plan } });
  } catch (err) { next(err); }
});

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id,email FROM users WHERE email=$1', [req.body.email?.toLowerCase().trim()]);
    if (rows[0]) {
      const token = await createToken(rows[0].id, 'reset_password', 15 * 60 * 1000);
      await sendResetEmail(rows[0].email, token).catch(console.warn);
    }
    res.json({ message: 'Si el email existe, recibirás un enlace en breve.' });
  } catch (err) { next(err); }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password || password.length < 8) return res.status(400).json({ error: 'Datos inválidos' });
    const row = await consumeToken(token, 'reset_password');
    if (!row) return res.status(400).json({ error: 'Enlace inválido o expirado' });
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [await bcrypt.hash(password, 12), row.user_id]);
    res.json({ message: 'Contraseña actualizada.' });
  } catch (err) { next(err); }
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

module.exports = router;
