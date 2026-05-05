require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const { init }   = require('./db');
const authRoutes      = require('./routes/auth');
const odooRoutes      = require('./routes/odoo');
const codesRoutes     = require('./routes/codes');
const profilesRoutes  = require('./routes/profiles');
const campaignsRoutes = require('./routes/campaigns');
const statsRoutes     = require('./routes/stats');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({
  origin:      process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());

app.get('/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.use('/api/auth',      authRoutes);
app.use('/api/odoo',      odooRoutes);
app.use('/api/codes',     codesRoutes);
app.use('/api/profiles',  profilesRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/stats',     statsRoutes);

app.use((err, req, res, _next) => {
  console.error(`[${req.method}] ${req.path}`, err.message);
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

init()
  .then(() => app.listen(PORT, () => console.log(`PromoCode API → http://localhost:${PORT}`)))
  .catch(err => { console.error('Error iniciando DB:', err); process.exit(1); });
