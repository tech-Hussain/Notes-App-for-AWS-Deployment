import type { RequestHandler } from 'express';

import { logger } from '../logger/logger';

const requestLogger: RequestHandler = (req, res, next) => {
    const startTime = process.hrtime.bigint();

    res.once('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;

        logger.info(
            {
                durationMs: Math.round(durationMs * 100) / 100,
                method: req.method,
                pathname: req.path,
                statusCode: res.statusCode,
            },
            'HTTP request completed',
        );
    });

    next();
};

export default requestLogger;