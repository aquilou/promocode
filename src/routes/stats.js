const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
const auth    = require('../middleware/auth');

router.use(auth);

// GET /api/stats
router.get('/', async (req, res, next) => {
  try {
    const uid = req.user.id;

    const { rows } = await pool.query(`
      WITH
      current_month AS (
        SELECT
          COUNT(*) FILTER (WHERE status = 'active')                       AS active_codes,
          COALESCE(SUM(uses), 0)                                          AS total_uses,
          COALESCE(AVG(conv_rate) FILTER (WHERE uses > 0), 0)             AS avg_conv,
          COALESCE(AVG(avg_ticket) FILTER (WHERE avg_ticket > 0), 0)      AS avg_ticket,
          COALESCE(SUM(sales), 0)                                         AS total_sales
        FROM codes WHERE user_id = $1
      ),
      prev_month AS (
        SELECT
          COUNT(*) FILTER (WHERE status = 'active')                       AS active_codes,
          COALESCE(SUM(uses), 0)                                          AS total_uses,
          COALESCE(AVG(conv_rate) FILTER (WHERE uses > 0), 0)             AS avg_conv,
          COALESCE(AVG(avg_ticket) FILTER (WHERE avg_ticket > 0), 0)      AS avg_ticket
        FROM codes
        WHERE user_id = $1
          AND created_at < DATE_TRUNC('month', NOW())
      )
      SELECT
        cm.active_codes,
        cm.total_uses,
        ROUND(cm.avg_conv::numeric, 1)   AS avg_conv,
        ROUND(cm.avg_ticket::numeric, 2) AS avg_ticket,
        cm.total_sales,
        (cm.active_codes - pm.active_codes)                                 AS delta_codes,
        CASE WHEN pm.total_uses = 0 THEN NULL
             ELSE ROUND(((cm.total_uses - pm.total_uses)::numeric / pm.total_uses * 100), 1)
        END                                                                 AS delta_uses_pct,
        ROUND((cm.avg_conv - pm.avg_conv)::numeric, 1)                     AS delta_conv,
        ROUND((cm.avg_ticket - pm.avg_ticket)::numeric, 2)                 AS delta_ticket
      FROM current_month cm, prev_month pm
    `, [uid]);

    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
