import type { ErrorRequestHandler } from 'express';

import { logger } from '../logger/logger';
import { ApiError } from '../utils/ApiError';
import { sendError } from '../utils/ApiResponse';

const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
    const isApiError = error instanceof ApiError;
    const statusCode = isApiError ? error.statusCode : 500;
    const message = isApiError ? error.message : 'Internal server error';

    if (!isApiError) {
        logger.error(
            {
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
                errorName: error instanceof Error ? error.name : 'UnknownError',
                method: req.method,
                pathname: req.path,
                statusCode,
            },
            'Request handling failed',
        );
    }

    return sendError(res, statusCode, message);
};

export default errorHandler;