/**
 * Sends one email: { to, subject, text, html }.
 *  - tests pass `config.sendEmail` (a fake that records messages)
 *  - "resend": the Resend HTTP API (switch on later with RESEND_API_KEY + EMAIL_PROVIDER=resend)
 *  - "log" (default): prints the email, links included, to the server log. Nothing is emailed.
 */
export function createEmailSender(config) {
  if (config.sendEmail) return config.sendEmail;

  if (config.emailProvider === 'resend') {
    if (!config.resendApiKey) throw new Error('EMAIL_PROVIDER=resend needs RESEND_API_KEY');
    return async ({ to, subject, text, html }) => {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: config.emailFrom, to: [to], subject, text, html }),
      });
      if (!res.ok) throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
    };
  }

  return async ({ to, subject, text }) => {
    if (config.isTest) return; // tests use a fake mailbox when they care about emails
    console.log(`[email:log] (not sent: EMAIL_PROVIDER=log)\n  to: ${to}\n  subject: ${subject}\n${text.replace(/^/gm, '  | ')}`);
  };
}

/** Plain, readable emails. Names come from users: escape them in the HTML version. */
const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const FRAME = {
  en: { hi: 'Hi', copy: 'Or copy this link:' },
  es: { hi: 'Hola', copy: 'O copia este enlace:' },
};

function layout({ name, intro, link, button, outro, language }) {
  const f = FRAME[language] ?? FRAME.en;
  const text = `${f.hi} ${name},\n\n${intro}\n\n${link}\n\n${outro}\n\nFuel the Ride`;
  const html = `<p>${f.hi} ${escapeHtml(name)},</p>
<p>${escapeHtml(intro)}</p>
<p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#2b59ba;color:#fff;border-radius:999px;text-decoration:none;font-weight:700">${escapeHtml(button)}</a></p>
<p style="color:#44464f;font-size:14px">${f.copy} ${link}</p>
<p style="color:#44464f;font-size:14px">${escapeHtml(outro)}</p>
<p>Fuel the Ride</p>`;
  return { text, html };
}

// Emails go out in the account's language (users.language: 'en' | 'es')
const VERIFY = {
  en: {
    subject: 'Confirm your email for Fuel the Ride',
    intro: 'Confirm your email address so you can reset your password if you ever need to.',
    button: 'Confirm my email',
    outro: "This link works for 24 hours. If you didn't create an account, you can ignore this email.",
  },
  es: {
    subject: 'Confirma tu correo para Fuel the Ride',
    intro: 'Confirma tu correo para que puedas restablecer tu contraseña si alguna vez lo necesitas.',
    button: 'Confirmar mi correo',
    outro: 'Este enlace funciona durante 24 horas. Si no creaste una cuenta, puedes ignorar este correo.',
  },
};

const RESET = {
  en: {
    subject: 'Reset your Fuel the Ride password',
    intro: 'Someone (hopefully you) asked to reset your password. Choose a new one here:',
    button: 'Choose a new password',
    outro: "This link works for 1 hour and only once. If you didn't ask for this, ignore this email: your password stays the same.",
  },
  es: {
    subject: 'Restablece tu contraseña de Fuel the Ride',
    intro: 'Alguien (esperamos que tú) pidió restablecer tu contraseña. Elige una nueva aquí:',
    button: 'Elegir una contraseña nueva',
    outro: 'Este enlace funciona durante 1 hora y una sola vez. Si no lo pediste, ignora este correo: tu contraseña no cambia.',
  },
};

const message = (copy) => ({ name, link, language = 'en' }) => {
  const c = copy[language] ?? copy.en;
  return { subject: c.subject, ...layout({ name, link, language, intro: c.intro, button: c.button, outro: c.outro }) };
};

export const verifyEmailMessage = message(VERIFY);
export const resetPasswordMessage = message(RESET);
