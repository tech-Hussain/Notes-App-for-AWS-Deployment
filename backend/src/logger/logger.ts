import pino from 'pino';

import { env } from '../config/env';

export const logger = pino({
    base: {
        service: 'notes-app-backend',
    },
    level: env.logLevel,
    redact: {
        censor: '[Redacted]',
        paths: [
            'authorization',
            'cookie',
            'password',
            'refreshToken',
            'req.headers.authorization',
            'req.headers.cookie',
            'token',
            'accessToken',
        ],
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    transport:
        env.nodeEnv === 'development'
            ? {
                options: {
                    colorize: true,
                    singleLine: true,
                    translateTime: 'SYS:standard',
                },
                target: 'pino-pretty',
            }
            : undefined,
});

export default logger;