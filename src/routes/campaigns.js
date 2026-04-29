  const express = require('express');
  const router  = express.Router();
  const { pool } = require('../db');
  const auth    = require('../middleware/auth');

  router.use(auth);

  router.get('/', async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT ca.*,
          COALESCE(SUM(co.uses), 0)       AS uses,
          COALESCE(AVG(co.conv_rate), 0)  AS conv,
          COALESCE(SUM(co.sales), 0)      AS sales,
          COALESCE(AVG(co.avg_ticket), 0) AS ticket,
          CASE WHEN COALESCE(ca.budget,0)=0 THEN 0
               ELSE ROUND(COALESCE(SUM(co.sales),0) / ca.budget, 2)
          END AS roi,
          ARRAY_AGG(co.code) FILTER (WHERE co.code IS NOT NULL) AS codes
         FROM campaigns ca
         LEFT JOIN codes co ON co.campaign_id = ca.id
         WHERE ca.user_id = $1
         GROUP BY ca.id
         ORDER BY ca.created_at DESC`,
        [req.user.id]
      );
      res.json({ campaigns: rows });
    } catch (err) { next(err); }
  });

  router.post('/', async (req, res, next) => {
    try {
      const { name, type, status, start_date, end_date, ecommerce, budget, description, color, color_bg, icon } =
  req.body;
      if (!name) return res.status(400).json({ error: 'name es obligatorio' });
      const { rows } = await pool.query(
        `INSERT INTO campaigns (user_id, name, type, status, start_date, end_date, ecommerce, budget, description,
  color, color_bg, icon)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [req.user.id, name, type||'propia', status||'active',
         start_date||null, end_date||null, ecommerce||'Odoo',
         budget||0, description||'',
         color||'#9e825a', color_bg||'rgba(158,130,90,.15)', icon||'📢']
      );
      res.status(201).json({ campaign: rows[0] });
    } catch (err) { next(err); }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const { name, type, status, start_date, end_date, ecommerce, budget, description, color, color_bg, icon } =
  req.body;
      const { rows } = await pool.query(
        `UPDATE campaigns SET
           name=$1, type=$2, status=$3, start_date=$4, end_date=$5,
           ecommerce=$6, budget=$7, description=$8, color=$9, color_bg=$10, icon=$11
         WHERE id=$12 AND user_id=$13 RETURNING *`,
        [name, type, status, start_date||null, end_date||null,
         ecommerce, budget, description, color, color_bg, icon,
         req.params.id, req.user.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Campaña no encontrada' });
      res.json({ campaign: rows[0] });
    } catch (err) { next(err); }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const { rowCount } = await pool.query(
        'DELETE FROM campaigns WHERE id=$1 AND user_id=$2',
        [req.params.id, req.user.id]
      );
      if (!rowCount) return res.status(404).json({ error: 'Campaña no encontrada' });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  module.exports = router;