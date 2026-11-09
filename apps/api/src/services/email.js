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
    console.log(`[email:log] (not sent: EMAIL_PROVIDER=log)\n  to: ${to}\n  subject: ${subject}\n${text.replace(/^/gm, '  | ')}`);
  };
}

/** Plain, readable emails. Names come from users: escape them in the HTML version. */
const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function layout({ name, intro, link, button, outro }) {
  const text = `Hi ${name},\n\n${intro}\n\n${link}\n\n${outro}\n\nFuel the Ride`;
  const html = `<p>Hi ${escapeHtml(name)},</p>
<p>${escapeHtml(intro)}</p>
<p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#0f6e4e;color:#fff;border-radius:8px;text-decoration:none;font-weight:700">${escapeHtml(button)}</a></p>
<p style="color:#5a635f;font-size:14px">Or copy this link: ${link}</p>
<p style="color:#5a635f;font-size:14px">${escapeHtml(outro)}</p>
<p>Fuel the Ride</p>`;
  return { text, html };
}

export const verifyEmailMessage = ({ name, link }) => ({
  subject: 'Confirm your email for Fuel the Ride',
  ...layout({
    name,
    intro: 'Confirm your email address so you can reset your password if you ever need to.',
    link,
    button: 'Confirm my email',
    outro: "This link works for 24 hours. If you didn't create an account, you can ignore this email.",
  }),
});

export const resetPasswordMessage = ({ name, link }) => ({
  subject: 'Reset your Fuel the Ride password',
  ...layout({
    name,
    intro: 'Someone (hopefully you) asked to reset your password. Choose a new one here:',
    link,
    button: 'Choose a new password',
    outro: "This link works for 1 hour and only once. If you didn't ask for this, ignore this email: your password stays the same.",
  }),
});
