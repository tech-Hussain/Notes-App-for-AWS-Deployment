import { randomUUID } from 'node:crypto';

import jwt, { type JwtPayload } from 'jsonwebtoken';

import { env } from '../config/env';
import { logger } from '../logger/logger';
import TokenRevocation from '../models/TokenRevocation';
import User from '../models/User';
import { ApiError } from '../utils/ApiError';

export type AuthTokenPayload = JwtPayload & {
    readonly credentialVersion: number;
    readonly jti: string;
    readonly sub: string;
    readonly iat?: number;
};

const AUTH_TOKEN_EXPIRY = '7d';

function isAuthTokenPayload(payload: string | JwtPayload): payload is AuthTokenPayload {
    return (
        typeof payload !== 'string' &&
        typeof payload.sub === 'string' &&
        typeof payload.jti === 'string' &&
        typeof payload.credentialVersion === 'number'
    );
}

export function signAuthToken(userId: string, credentialVersion: number = 0): string {
    const tokenId = randomUUID();

    return jwt.sign({ credentialVersion, jti: tokenId, sub: userId }, env.jwtSecret, {
        expiresIn: AUTH_TOKEN_EXPIRY,
    });
}

export async function verifyAuthToken(token: string): Promise<AuthTokenPayload> {
    let payload: string | JwtPayload;
    try {
        payload = jwt.verify(token, env.jwtSecret);
    } catch {
        throw new ApiError('Invalid or expired authentication token', 401);
    }

    if (!isAuthTokenPayload(payload)) {
        throw new ApiError('Invalid authentication token payload', 401);
    }

    try {
        const revokedToken = await TokenRevocation.findOne({ jti: payload.jti }).select('_id').lean();

        if (revokedToken !== null) {
            throw new ApiError('Authentication token revoked', 401);
        }
    } catch (error: unknown) {
        if (error instanceof ApiError) {
            throw error;
        }

        logger.error({ errorName: error instanceof Error ? error.name : 'UnknownError' }, 'Token revocation lookup failed');
        throw new ApiError('Authentication failed', 401);
    }

    try {
        const user = await User.findById(payload.sub).select('credentialVersion').lean();

        if (user === null || (user.credentialVersion ?? 0) !== payload.credentialVersion) {
            throw new ApiError('Authentication token revoked', 401);
        }
    } catch (error: unknown) {
        if (error instanceof ApiError) {
            throw error;
        }

        logger.error({ errorName: error instanceof Error ? error.name : 'UnknownError' }, 'Credential version verification failed');
        throw new ApiError('Authentication failed', 401);
    }

    return payload;
}
