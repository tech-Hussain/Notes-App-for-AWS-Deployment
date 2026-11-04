import 'mocha';
import { expect } from 'chai';
import type { Request, Response } from 'express';

import { getHealthStatus } from '../src/controllers/health.controller';
import authMiddleware from '../src/middleware/authMiddleware';
import notFound from '../src/middleware/notFound';
import { ApiError } from '../src/utils/ApiError';
import { signAuthToken } from '../src/utils/jwt';
import jwt from 'jsonwebtoken';
import User from '../src/models/User';
import TokenRevocation from '../src/models/TokenRevocation';
import sinon from 'sinon';
import mongoose from 'mongoose';
import type { SuccessApiResponse } from '../src/utils/ApiResponse';

type HealthResponse = {
    readonly status: string;
    readonly db: string;
    readonly uptime: number;
    readonly version: string;
};

function setReadyState(value: number): void {
    Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, get: () => value });
}

describe('Health Controller & Middleware Unit Tests', () => {
    afterEach(() => {
        sinon.restore();
        delete (mongoose.connection as unknown as Record<string, unknown>).readyState;
    });
    describe('getHealthStatus', () => {
        it('returns 200 OK with health status and uptime', () => {
            setReadyState(1);
            let responseStatus = 0;
            let responseBody: unknown = null;

            const res = {
                status(code: number) {
                    responseStatus = code;
                    return this;
                },
                json(data: unknown) {
                    responseBody = data;
                    return this;
                },
            } as Response;

            getHealthStatus({} as Request, res);

            const typedResponseBody = responseBody as SuccessApiResponse<HealthResponse>;
            expect(responseStatus).to.equal(200);
            expect(typedResponseBody).to.have.property('success', true);
            expect(typedResponseBody).to.have.property('message', 'Server is healthy');
            expect(typedResponseBody.data).to.have.property('status', 'ok');
            expect(typedResponseBody.data).to.have.property('uptime');
            expect(typedResponseBody.data).to.have.property('db', 'up');
            expect(typedResponseBody.data).to.have.property('version');
        });

        it('returns 503 when the database is not connected', () => {
            setReadyState(0);
            let responseStatus = 0;
            const res = {
                status(code: number) {
                    responseStatus = code;
                    return this;
                },
                json() {
                    return this;
                },
            } as unknown as Response;

            getHealthStatus({} as Request, res);

            expect(responseStatus).to.equal(503);
        });
    });

    describe('notFound middleware', () => {
        it('passes 404 ApiError to next function', () => {
            let passedError: unknown = null;

            notFound({} as Request, {} as Response, (err) => {
                passedError = err;
            });

            expect(passedError).to.be.instanceOf(ApiError);
            expect((passedError as ApiError).statusCode).to.equal(404);
            expect((passedError as ApiError).message).to.equal('Route not found');
        });
    });

    describe('authMiddleware', () => {
        it('passes 401 error when Authorization header is missing', async () => {
            let passedError: unknown = null;

            const req = {
                header(_name: string) {
                    return undefined;
                },
            } as Request;

            try {
                await authMiddleware(req, {} as Response, (err) => {
                    passedError = err;
                });
            } catch (err: unknown) {
                expect.fail(`authMiddleware call failed unexpectedly: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(passedError).to.be.instanceOf(ApiError);
            expect((passedError as ApiError).statusCode).to.equal(401);
            expect((passedError as ApiError).message).to.equal('Authentication required');
        });

        it('passes 401 error when scheme is not Bearer or token is empty or has extra parts', async () => {
            const invalidHeaders = ['Basic xyz', 'Bearer', 'Bearer token extra_part', 'NotBearer token'];

            for (const header of invalidHeaders) {
                let passedError: unknown = null;

                const req = {
                    header(_name: string) {
                        return header;
                    },
                } as Request;

                try {
                    await authMiddleware(req, {} as Response, (err) => {
                        passedError = err;
                    });
                } catch (err: unknown) {
                    expect.fail(`authMiddleware call failed unexpectedly: ${err instanceof Error ? err.message : String(err)}`);
                }

                expect(passedError).to.be.instanceOf(ApiError);
                expect((passedError as ApiError).statusCode).to.equal(401);
                expect((passedError as ApiError).message).to.equal('Invalid authorization header');
            }
        });

        it('successfully authenticates valid Bearer token and attaches authenticatedUser', async () => {
            const validUserId = '507f1f77bcf86cd799439011';
            const token = signAuthToken(validUserId, 0);

            sinon.stub(TokenRevocation, 'findOne').returns({
                select: sinon.stub().returnsThis(),
                lean: sinon.stub().resolves(null),
            } as unknown as ReturnType<typeof TokenRevocation.findOne>);

            sinon.stub(User, 'findById').returns({
                select: sinon.stub().returnsThis(),
                lean: sinon.stub().resolves({ credentialVersion: 0 }),
            } as unknown as ReturnType<typeof User.findById>);

            let nextCalled = false;

            const req = {
                header(name: string) {
                    if (name.toLowerCase() === 'authorization') {
                        return `Bearer ${token}`;
                    }
                    return undefined;
                },
            } as unknown as Request;

            try {
                await authMiddleware(req, {} as Response, (err) => {
                    expect(err).to.be.undefined;
                    nextCalled = true;
                });
            } catch (err: unknown) {
                expect.fail(`authMiddleware call failed unexpectedly: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(nextCalled).to.be.true;
            expect(req.authenticatedUser).to.be.an('object');
            expect(req.authenticatedUser?.userId).to.equal(validUserId);
            expect(req.authenticatedUser?.tokenId).to.be.a('string').that.is.not.empty;
            expect(req.authenticatedUser?.expiresAt).to.be.instanceOf(Date);
        });

        it('handles non-ApiError verification errors gracefully returning 401 ApiError', async () => {
            let passedError: unknown = null;

            const req = {
                header(_name: string) {
                    return 'Bearer completely_malformed_token_123';
                },
            } as Request;

            try {
                await authMiddleware(req, {} as Response, (err) => {
                    passedError = err;
                });
            } catch (err: unknown) {
                expect.fail(`authMiddleware call failed unexpectedly: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(passedError).to.be.instanceOf(ApiError);
            expect((passedError as ApiError).statusCode).to.equal(401);
        });
    });
});
