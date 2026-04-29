  const express = require('express');
  const router  = express.Router();
  const { pool } = require('../db');
  const auth    = require('../middleware/auth');

  router.use(auth);

  router.get('/stats', async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT
          COUNT(*)                                          AS total_codes,
          COUNT(*) FILTER (WHERE status='active')          AS active_codes,
          COALESCE(SUM(uses), 0)                           AS total_uses,
          COALESCE(SUM(sales), 0)                          AS total_sales,
          COALESCE(AVG(conv_rate) FILTER (WHERE conv_rate > 0), 0) AS avg_conv
         FROM codes WHERE user_id = $1`,
        [req.user.id]
      );
      res.json({ stats: rows[0] });
    } catch (err) { next(err); }
  });

  router.get('/', async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT co.*,
          p.name     AS profile_name,
          p.handle   AS profile_handle,
          p.initials AS profile_initials,
          ca.name    AS campaign_name
         FROM codes co
         LEFT JOIN profiles  p  ON p.id  = co.profile_id
         LEFT JOIN campaigns ca ON ca.id = co.campaign_id
         WHERE co.user_id = $1
         ORDER BY co.created_at DESC`,
        [req.user.id]
      );
      res.json({ codes: rows });
    } catch (err) { next(err); }
  });

  router.post('/', async (req, res, next) => {
    try {
      const { code, type, platform, discount, max_uses, conv_rate, sales, avg_ticket, ecommerce, expires_at, status,
  profile_id, campaign_id } = req.body;
      if (!code) return res.status(400).json({ error: 'code es obligatorio' });
      const { rows } = await pool.query(
        `INSERT INTO codes (user_id, profile_id, campaign_id, code, type, platform, discount, max_uses, conv_rate,
  sales, avg_ticket, ecommerce, expires_at, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [req.user.id, profile_id||null, campaign_id||null, code.toUpperCase(),
         type||'Influencer', platform||'Instagram', discount||'10%',
         max_uses||500, conv_rate||0, sales||0, avg_ticket||0,
         ecommerce||'Odoo', expires_at||null, status||'active']
      );
      res.status(201).json({ code: rows[0] });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Ese código ya existe' });
      next(err);
    }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const { code, type, platform, discount, uses, max_uses, conv_rate, sales, avg_ticket, ecommerce, expires_at,
  status, profile_id, campaign_id } = req.body;
      const { rows } = await pool.query(
        `UPDATE codes SET
           code=COALESCE($1,code), type=$2, platform=$3, discount=$4, uses=$5, max_uses=$6,
           conv_rate=$7, sales=$8, avg_ticket=$9, ecommerce=$10,
           expires_at=$11, status=$12, profile_id=$13, campaign_id=$14
         WHERE id=$15 AND user_id=$16 RETURNING *`,
        [code?code.toUpperCase():null, type, platform, discount, uses, max_uses,
         conv_rate, sales, avg_ticket, ecommerce, expires_at||null, status,
         profile_id||null, campaign_id||null, req.params.id, req.user.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Código no encontrado' });
      res.json({ code: rows[0] });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Ese código ya existe' });
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const { rowCount } = await pool.query(
        'DELETE FROM codes WHERE id=$1 AND user_id=$2',
        [req.params.id, req.user.id]
      );
      if (!rowCount) return res.status(404).json({ error: 'Código no encontrado' });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  module.exports = router;