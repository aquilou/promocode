const express     = require('express');
const { pool }    = require('../db');
const requireAuth = require('../middleware/auth');
const { encrypt, decrypt } = require('../services/crypto');
const odoo        = require('../services/odoo');

const router = express.Router();
router.use(requireAuth);

async function getConfig(userId) {
  const { rows } = await pool.query('SELECT * FROM odoo_configs WHERE user_id=$1', [userId]);
  if (!rows[0]) return null;
  return { ...rows[0], apiKey: decrypt(rows[0].api_key_enc) };
}

router.post('/connect', async (req, res, next) => {
  try {
    const { url, database, login, apiKey } = req.body;
    if (!url || !database || !login || !apiKey) return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    let cleanUrl;
    try { const u = new URL(url); cleanUrl = `${u.protocol}//${u.host}`; }
    catch { return res.status(400).json({ error: 'URL inválida' }); }
    const version = await odoo.getVersion(cleanUrl);
    await odoo.authenticate(cleanUrl, database, login, apiKey);
    await pool.query(
      `INSERT INTO odoo_configs (user_id,url,database,login,api_key_enc)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id) DO UPDATE SET url=$2,database=$3,login=$4,api_key_enc=$5,connected_at=NOW()`,
      [req.user.id, cleanUrl, database, login, encrypt(apiKey)]
    );
    res.json({ success: true, version: version?.server_version || 'desconocida' });
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') return res.status(400).json({ error: 'No se pudo alcanzar la URL' });
    if (err.message?.includes('inválidas')) return res.status(401).json({ error: 'Login o clave API incorrectos' });
    next(err);
  }
});

router.delete('/disconnect', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM odoo_configs WHERE user_id=$1', [req.user.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/status', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT url,database,login,connected_at,last_sync FROM odoo_configs WHERE user_id=$1', [req.user.id]
    );
    res.json({ connected: !!rows[0], config: rows[0] || null });
  } catch (err) { next(err); }
});

router.get('/programs', async (req, res, next) => {
  try {
    const config = await getConfig(req.user.id);
    if (!config) return res.status(404).json({ error: 'Odoo no conectado' });
    res.json({ programs: await odoo.getPrograms(config) });
  } catch (err) { next(err); }
});

router.get('/codes', async (req, res, next) => {
  try {
    const config = await getConfig(req.user.id);
    if (!config) return res.status(404).json({ error: 'Odoo no conectado' });
    const codes = await odoo.getCodes(config);
    await pool.query('UPDATE odoo_configs SET last_sync=NOW() WHERE user_id=$1', [req.user.id]);
    res.json({ codes });
  } catch (err) { next(err); }
});

router.post('/codes', async (req, res, next) => {
  try {
    const config = await getConfig(req.user.id);
    if (!config) return res.status(404).json({ error: 'Odoo no conectado' });
    if (!req.body.code || !req.body.programId) return res.status(400).json({ error: 'code y programId requeridos' });
    res.status(201).json({ success: true, id: await odoo.createCode(config, req.body) });
  } catch (err) { next(err); }
});

router.get('/stats', async (req, res, next) => {
  try {
    const config = await getConfig(req.user.id);
    if (!config) return res.status(404).json({ error: 'Odoo no conectado' });
    res.json(await odoo.getStats(config));
  } catch (err) { next(err); }
});

module.exports = router;
