import type { ErrorRequestHandler } from 'express';

function errorType(err: unknown) {
  return typeof err === 'object' && err !== null && 'type' in err
    ? String((err as { type?: unknown }).type || '')
    : '';
}

export const jsonBodyErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  const type = errorType(err);
  if (type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Request body must be valid JSON.',
      code: 'INVALID_JSON',
    });
  }
  if (type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Request body is too large.',
      code: 'JSON_BODY_TOO_LARGE',
    });
  }
  next(err);
};

export const apiErrorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const errorName = err instanceof Error ? err.name : typeof err;
  console.error('[api error]', { errorName });
  if (res.headersSent) return;
  res.status(500).json({
    error: 'Internal server error.',
    code: 'INTERNAL_ERROR',
  });
};
