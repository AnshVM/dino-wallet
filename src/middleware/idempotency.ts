import type { Request, Response, NextFunction } from 'express';

export function requireIdempotencyKey(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['idempotency-key'];

  if (!key || typeof key !== 'string') {
    res.status(400).json({ error: 'Idempotency-Key header is required' });
    return;
  }

  res.locals['idempotencyKey'] = key;
  next();
}
