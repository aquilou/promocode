const xmlrpc = require('xmlrpc');

function makeClient(baseUrl, path) {
  const u = new URL(baseUrl);
  const isHttps = u.protocol === 'https:';
  const opts = { host: u.hostname, port: u.port ? parseInt(u.port) : (isHttps ? 443 : 80), path };
  return isHttps ? xmlrpc.createSecureClient(opts) : xmlrpc.createClient(opts);
}

function call(client, method, params) {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params, (err, result) => err ? reject(err) : resolve(result));
  });
}

async function authenticate(url, db, login, apiKey) {
  const client = makeClient(url, '/xmlrpc/2/common');
  const uid    = await call(client, 'authenticate', [db, login, apiKey, {}]);
  if (!uid) throw new Error('Credenciales inválidas');
  return uid;
}

async function execute(url, db, login, apiKey, model, method, args = [], kwargs = {}) {
  const uid    = await authenticate(url, db, login, apiKey);
  const client = makeClient(url, '/xmlrpc/2/object');
  return call(client, 'execute_kw', [db, uid, apiKey, model, method, args, kwargs]);
}

async function getVersion(url) {
  return call(makeClient(url, '/xmlrpc/2/common'), 'version', []);
}

async function getPrograms({ url, database, login, apiKey }) {
  return execute(url, database, login, apiKey, 'loyalty.program', 'search_read',
    [[['active', '=', true]]], { fields: ['id', 'name', 'program_type'], limit: 100 });
}

async function getCodes({ url, database, login, apiKey }) {
  return execute(url, database, login, apiKey, 'loyalty.card', 'search_read',
    [[]], { fields: ['code', 'program_id', 'points', 'use_count', 'expiration_date'], order: 'id desc', limit: 200 });
}

async function createCode({ url, database, login, apiKey }, { code, programId, partnerId = false, points = 1,
expirationDate = false }) {
  return execute(url, database, login, apiKey, 'loyalty.card', 'create',
    [{ code, program_id: programId, partner_id: partnerId || false, points, expiration_date: expirationDate || false }]);
}

async function getStats({ url, database, login, apiKey }) {
  const orders = await execute(url, database, login, apiKey, 'sale.order', 'search_read',
    [[['state', 'in', ['sale', 'done']], ['coupon_ids', '!=', false]]],
    { fields: ['amount_total'], limit: 1000 });
  const total  = orders.reduce((s, o) => s + (o.amount_total || 0), 0);
  const ticket = orders.length ? total / orders.length : 0;
  return { orders: orders.length, totalSales: Math.round(total * 100) / 100, ticketMedio: Math.round(ticket * 100) / 100 };
}

module.exports = { authenticate, getVersion, getPrograms, getCodes, createCode, getStats };
