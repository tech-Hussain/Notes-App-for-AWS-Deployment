import type { Request, Response } from 'express';
import mongoose from 'mongoose';

import { sendError, sendSuccess } from '../utils/ApiResponse';

type HealthResponse = {
    readonly status: 'ok';
    readonly db: 'up';
    readonly uptime: number;
    readonly version: string;
};

export function getHealthStatus(_req: Request, res: Response): Response {
    if (mongoose.connection.readyState !== 1) {
        return sendError(res, 503, 'Database unavailable');
    }

    return sendSuccess<HealthResponse>(res, 200, 'Server is healthy', {
        db: 'up',
        status: 'ok',
        uptime: process.uptime(),
        version: process.env.APP_VERSION ?? 'dev',
    });
}
