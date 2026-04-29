  const express = require('express');
  const router  = express.Router();
  const { pool } = require('../db');
  const auth    = require('../middleware/auth');

  router.use(auth);

  router.get('/', async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT p.*,
          COUNT(DISTINCT c.id) FILTER (WHERE c.status='active') AS active_codes,
          COUNT(DISTINCT c.id)                                   AS total_codes,
          COALESCE(SUM(c.uses), 0)                              AS total_uses,
          COALESCE(AVG(c.conv_rate), 0)                         AS conv,
          COALESCE(SUM(c.sales), 0)                             AS sales,
          COALESCE(AVG(c.avg_ticket), 0)                        AS ticket
         FROM profiles p
         LEFT JOIN codes c ON c.profile_id = p.id
         WHERE p.user_id = $1
         GROUP BY p.id
         ORDER BY p.created_at DESC`,
        [req.user.id]
      );
      res.json({ profiles: rows });
    } catch (err) { next(err); }
  });

  router.post('/', async (req, res, next) => {
    try {
      const { name, handle, initials, type, platform, followers, engagement, bio, email, status } = req.body;
      if (!name || !handle) return res.status(400).json({ error: 'name y handle son obligatorios' });
      const { rows } = await pool.query(
        `INSERT INTO profiles (user_id, name, handle, initials, type, platform, followers, engagement, bio, email,
  status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [req.user.id, name, handle,
         initials || name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase(),
         type||'influencer', platform||'Instagram',
         followers||'0', engagement||'0%', bio||'', email||'', status||'active']
      );
      res.status(201).json({ profile: rows[0] });
    } catch (err) { next(err); }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const { name, handle, initials, type, platform, followers, engagement, bio, email, status } = req.body;
      const { rows } = await pool.query(
        `UPDATE profiles SET
           name=$1, handle=$2, initials=$3, type=$4, platform=$5,
           followers=$6, engagement=$7, bio=$8, email=$9, status=$10
         WHERE id=$11 AND user_id=$12 RETURNING *`,
        [name, handle, initials, type, platform, followers, engagement, bio, email, status,
         req.params.id, req.user.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Perfil no encontrado' });
      res.json({ profile: rows[0] });
    } catch (err) { next(err); }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const { rowCount } = await pool.query(
        'DELETE FROM profiles WHERE id=$1 AND user_id=$2',
        [req.params.id, req.user.id]
      );
      if (!rowCount) return res.status(404).json({ error: 'Perfil no encontrado' });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  module.exports = router;