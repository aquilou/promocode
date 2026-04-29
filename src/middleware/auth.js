const jwt      = require('jsonwebtoken');
const { pool } = require('../db');

module.exports = async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  try {
    const token   = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      'SELECT id, email, name, plan FROM users WHERE id = $1', [payload.sub]
    );
    if (!rows[0]) return res.status(401).json({ error: 'Usuario no encontrado' });
    req.user = rows[0];
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
};
