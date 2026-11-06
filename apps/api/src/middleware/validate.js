import { HttpError } from '../utils/httpError.js';

/**
 * Validates req.params / req.query / req.body with zod schemas.
 * Parsed values go to req.valid (Express 5 makes req.query read-only).
 */
export const validate = (schemas) => (req, _res, next) => {
  req.valid = {};
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
      throw new HttpError(400, 'VALIDATION_FAILED', 'Some fields are invalid', details);
    }
    req.valid[part] = result.data;
  }
  next();
};
