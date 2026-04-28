const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.RESEND_FROM  || 'onboarding@resend.dev';
const BASE   = process.env.FRONTEND_URL || 'http://localhost:5500';

function template(body) {
  return `<div style="background:#0c0c0c;padding:40px 0;font-family:sans-serif">
    <div style="max-width:480px;margin:0 auto;background:#141414;border:1px solid
#242424;border-radius:14px;overflow:hidden">
      <div style="padding:20px 28px;border-bottom:1px solid #242424">
        <span style="font-size:14px;font-weight:700;color:#f0f0f0">PromoCode</span>
      </div>
      <div style="padding:28px">${body}</div>
      <div style="padding:14px 28px;border-top:1px solid #242424;text-align:center;font-size:11px;color:#555">
        Si no reconoces esta acción, ignora este email.
      </div>
    </div>
  </div>`;
}

function btn(href, text) {
  return `<a href="${href}" style="display:inline-block;background:#fff;color:#000;padding:11px
22px;border-radius:9px;text-decoration:none;font-weight:700;font-size:13px">${text}</a>`;
}

async function sendVerificationEmail(email, token) {
  const link = `${BASE}/auth.html?action=verify&token=${token}`;
  await resend.emails.send({
    from: FROM, to: email,
    subject: 'Verifica tu cuenta — PromoCode',
    html: template(`<h2 style="color:#fff;margin:0 0 8px">Bienvenido a PromoCode</h2>
      <p style="color:#888;margin:0 0 22px">Activa tu cuenta haciendo clic abajo. Expira en 24h.</p>
      ${btn(link, 'Verificar cuenta')}`),
  });
}

async function sendResetEmail(email, token) {
  const link = `${BASE}/auth.html?action=reset&token=${token}`;
  await resend.emails.send({
    from: FROM, to: email,
    subject: 'Recuperar contraseña — PromoCode',
    html: template(`<h2 style="color:#fff;margin:0 0 8px">Restablecer contraseña</h2>
      <p style="color:#888;margin:0 0 22px">El enlace expira en <strong style="color:#f0f0f0">15 minutos</strong>.</p>
      ${btn(link, 'Cambiar contraseña')}`),
  });
}

module.exports = { sendVerificationEmail, sendResetEmail };
