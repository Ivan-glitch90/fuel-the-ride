import mongoose from 'mongoose';
import { HttpError } from '../utils/httpError.js';

export function notFound(req, _res, next) {
  next(new HttpError(404, 'NOT_FOUND', `No route for ${req.method} ${req.path}`));
}

const send = (res, status, code, message, details) =>
  res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });

// Every error leaves the API in one shape: { error: { code, message, details? } }
export function errorHandler(config) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, _next) => {
    if (err instanceof HttpError) return send(res, err.status, err.code, err.message, err.details);
    if (err?.name === 'FuelInputError') {
      // Same code as request validation, so clients handle one kind of 400
      const details = err.field ? [{ path: err.field, message: err.message }] : undefined;
      return send(res, 400, 'VALIDATION_FAILED', err.message, details);
    }
    if (err instanceof mongoose.Error.CastError) return send(res, 400, 'INVALID_ID', 'Invalid id');
    if (err?.code === 11000) return send(res, 409, 'DUPLICATE', 'That already exists');
    if (err?.type === 'entity.parse.failed') return send(res, 400, 'INVALID_JSON', 'Request body is not valid JSON');
    if (err?.type === 'entity.too.large') return send(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');

    if (!config.isTest) console.error(err);
    return send(res, 500, 'INTERNAL', 'Something went wrong');
  };
}
