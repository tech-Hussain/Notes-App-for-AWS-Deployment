import type { NextFunction, Request, Response } from 'express';

import { logger } from '../logger/logger';
import { ApiError } from '../utils/ApiError';
import { verifyAuthToken } from '../utils/jwt';

export type AuthenticatedUserContext = {
    readonly expiresAt?: Date;
    readonly tokenId: string;
    readonly userId: string;
};

declare module 'express-serve-static-core' {
    interface Request {
        authenticatedUser?: AuthenticatedUserContext;
    }
}

function parseBearerToken(authorizationHeader: string): string {
    const [scheme, token, ...rest] = authorizationHeader.split(' ');

    if (scheme !== 'Bearer' || token === undefined || token.trim().length === 0 || rest.length > 0) {
        throw new ApiError('Invalid authorization header', 401);
    }

    return token;
}

function getExpiresAtFromPayload(payload: { readonly exp?: number }): Date | undefined {
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
        return undefined;
    }

    const expiresAt = new Date(payload.exp * 1000);

    if (Number.isNaN(expiresAt.getTime())) {
        return undefined;
    }

    return expiresAt;
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const authorizationHeader = req.header('authorization');

    if (authorizationHeader === undefined) {
        next(new ApiError('Authentication required', 401));
        return;
    }

    try {
        const token = parseBearerToken(authorizationHeader);
        const payload = await verifyAuthToken(token);

        req.authenticatedUser = {
            expiresAt: getExpiresAtFromPayload(payload),
            tokenId: payload.jti,
            userId: payload.sub,
        };

        next();
    } catch (error: unknown) {
        logger.warn({ err: error }, 'Authentication failed');
        next(error instanceof ApiError ? error : new ApiError('Invalid or expired authentication token', 401));
    }
}

export default authMiddleware;