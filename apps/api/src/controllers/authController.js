import { createAuthService } from '../services/authService.js';
import { getUser } from '../services/userService.js';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../services/tokens.js';

const isMobile = (req) => req.get('x-client-type') === 'mobile';

export function createAuthController(config) {
  const auth = createAuthService(config);

  const base = { httpOnly: true, secure: config.cookieSecure };
  const accessCookie = { ...base, sameSite: 'lax', path: '/api', maxAge: config.accessTokenTtlSec * 1000 };
  const refreshCookie = {
    ...base,
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: config.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  };

  // Web gets httpOnly cookies. Mobile (X-Client-Type: mobile) gets the tokens in the body instead.
  function sendTokens(req, res, status, tokens, body = {}) {
    if (isMobile(req)) return res.status(status).json({ ...body, ...tokens });
    res.cookie(ACCESS_COOKIE, tokens.accessToken, accessCookie);
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookie);
    return res.status(status).json(body);
  }

  function clearCookies(res) {
    res.clearCookie(ACCESS_COOKIE, { ...accessCookie, maxAge: undefined });
    res.clearCookie(REFRESH_COOKIE, { ...refreshCookie, maxAge: undefined });
  }

  const meta = (req) => ({ userAgent: req.get('user-agent') });
  const presentedRefreshToken = (req) => req.valid?.body?.refreshToken ?? req.cookies?.[REFRESH_COOKIE];

  return {
    async register(req, res) {
      const { user, tokens } = await auth.register(req.valid.body, meta(req));
      sendTokens(req, res, 201, tokens, { user });
    },

    async login(req, res) {
      const { user, tokens } = await auth.login(req.valid.body, meta(req));
      sendTokens(req, res, 200, tokens, { user });
    },

    // 201 + created: true for a brand-new rider (the app then sends them to their profile)
    async google(req, res) {
      const { user, created, tokens } = await auth.loginWithGoogle(req.valid.body.credential, meta(req));
      sendTokens(req, res, created ? 201 : 200, tokens, { user, created });
    },

    // Which sign-in options the app should show. The Google client ID is public by design.
    providers(_req, res) {
      res.json({ google: auth.googleEnabled && config.googleClientIds[0] ? { clientId: config.googleClientIds[0] } : null });
    },

    async refresh(req, res) {
      try {
        const tokens = await auth.refresh(presentedRefreshToken(req), meta(req));
        sendTokens(req, res, 200, tokens, { ok: true });
      } catch (err) {
        clearCookies(res);
        throw err;
      }
    },

    async logout(req, res) {
      await auth.logout(presentedRefreshToken(req));
      clearCookies(res);
      res.status(204).end();
    },

    async me(req, res) {
      res.json({ user: await getUser(req.user.id) });
    },
  };
}
