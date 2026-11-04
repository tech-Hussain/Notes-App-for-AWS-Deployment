import type { RequestHandler } from 'express';

import { ApiError } from '../utils/ApiError';

const notFound: RequestHandler = (_req, _res, next) => {
    next(new ApiError('Route not found', 404));
};

export default notFound;