import 'mocha';
import { expect } from 'chai';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import sinon from 'sinon';
import { env } from '../src/config/env';
import TokenRevocation from '../src/models/TokenRevocation';
import User from '../src/models/User';
import { ApiError } from '../src/utils/ApiError';
import { signAuthToken, verifyAuthToken, type AuthTokenPayload } from '../src/utils/jwt';

describe('JWT Utility (jwt.ts)', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('signAuthToken', () => {
        it('should generate a valid JWT string containing userId (sub), random UUID (jti), and credentialVersion', () => {
            const userId = '507f1f77bcf86cd799439011';
            const token = signAuthToken(userId, 1);

            expect(token).to.be.a('string');

            const decoded = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
            expect(decoded.sub).to.equal(userId);
            expect(decoded.jti).to.be.a('string').that.is.not.empty;
            expect(decoded.credentialVersion).to.equal(1);
        });
    });

    describe('verifyAuthToken', () => {
        it('should verify and return the token payload for a valid, non-revoked token with matching credentialVersion', async () => {
            const userId = '507f1f77bcf86cd799439011';
            const token = signAuthToken(userId, 0);

            const findOneStub = sinon.stub(TokenRevocation, 'findOne').returns({
                select: sinon.stub().returnsThis(),
                lean: sinon.stub().resolves(null),
            } as unknown as ReturnType<typeof TokenRevocation.findOne>);

            sinon.stub(User, 'findById').returns({
                select: sinon.stub().returnsThis(),
                lean: sinon.stub().resolves({ credentialVersion: 0 }),
            } as unknown as ReturnType<typeof User.findById>);

            let payload: AuthTokenPayload;
            try {
                payload = await verifyAuthToken(token);
            } catch (err: unknown) {
                expect.fail(`verifyAuthToken rejected unexpectedly: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(payload.sub).to.equal(userId);
            expect(payload.jti).to.be.a('string');
            expect(payload.credentialVersion).to.equal(0);
            expect(findOneStub.calledOnce).to.be.true;
        });

        it('should throw ApiError with 401 status for malformed or invalid tokens', async () => {
            try {
                await verifyAuthToken('invalid.token.string');
                expect.fail('Expected verifyAuthToken to throw');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(ApiError);
                if (err instanceof ApiError) {
                    expect(err.statusCode).to.equal(401);
                    expect(err.message).to.equal('Invalid or expired authentication token');
                }
            }
        });

        it('should throw ApiError when token payload is missing required sub, jti, or credentialVersion fields', async () => {
            const invalidPayloadToken = jwt.sign({ sub: '507f1f77bcf86cd799439011', jti: 'test-uuid' }, env.jwtSecret);

            try {
                await verifyAuthToken(invalidPayloadToken);
                expect.fail('Expected verifyAuthToken to throw for missing credentialVersion');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(ApiError);
                if (err instanceof ApiError) {
                    expect(err.statusCode).to.equal(401);
                    expect(err.message).to.equal('Invalid authentication token payload');
                }
            }
        });

        it('should throw ApiError with 401 when the token has been revoked', async () => {
            const userId = '507f1f77bcf86cd799439011';
            const token = signAuthToken(userId, 0);
            const revokedId = new Types.ObjectId();

            sinon.stub(TokenRevocation, 'findOne').returns({
                select: sinon.stub().returnsThis(),
                lean: sinon.stub().resolves({ _id: revokedId }),
            } as unknown as ReturnType<typeof TokenRevocation.findOne>);

            try {
                await verifyAuthToken(token);
                expect.fail('Expected verifyAuthToken to throw for revoked token');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(ApiError);
                if (err instanceof ApiError) {
                    expect(err.statusCode).to.equal(401);
                    expect(err.message).to.equal('Authentication token revoked');
                }
            }
        });

        it('should reject old token issued in the same Unix second when credential version was incremented', async () => {
            const userId = '507f1f77bcf86cd799439011';
            // Token created with version 0
            const oldToken = signAuthToken(userId, 0);

            sinon.stub(TokenRevocation, 'findOne').returns({
                select: sinon.stub().returnsThis(),
                lean: sinon.stub().resolves(null),
            } as unknown as ReturnType<typeof TokenRevocation.findOne>);

            // User's version incremented to 1 in the exact same second
            sinon.stub(User, 'findById').returns({
                select: sinon.stub().returnsThis(),
                lean: sinon.stub().resolves({ credentialVersion: 1 }),
            } as unknown as ReturnType<typeof User.findById>);

            try {
                await verifyAuthToken(oldToken);
                expect.fail('Expected verifyAuthToken to reject old token with outdated credentialVersion');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(ApiError);
                if (err instanceof ApiError) {
                    expect(err.statusCode).to.equal(401);
                    expect(err.message).to.equal('Authentication token revoked');
                }
            }
        });

        it('should accept new token issued with incremented credential version', async () => {
            const userId = '507f1f77bcf86cd799439011';
            // New token created with version 1
            const newToken = signAuthToken(userId, 1);

            sinon.stub(TokenRevocation, 'findOne').returns({
                select: sinon.stub().returnsThis(),
                lean: sinon.stub().resolves(null),
            } as unknown as ReturnType<typeof TokenRevocation.findOne>);

            sinon.stub(User, 'findById').returns({
                select: sinon.stub().returnsThis(),
                lean: sinon.stub().resolves({ credentialVersion: 1 }),
            } as unknown as ReturnType<typeof User.findById>);

            let payload: AuthTokenPayload;
            try {
                payload = await verifyAuthToken(newToken);
            } catch (err: unknown) {
                expect.fail(`verifyAuthToken rejected unexpectedly: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(payload.sub).to.equal(userId);
            expect(payload.credentialVersion).to.equal(1);
        });

        it('should reject token when credential version differs from user current version', async () => {
            const userId = '507f1f77bcf86cd799439011';
            const token = signAuthToken(userId, 0);

            sinon.stub(TokenRevocation, 'findOne').returns({
                select: sinon.stub().returnsThis(),
                lean: sinon.stub().resolves(null),
            } as unknown as ReturnType<typeof TokenRevocation.findOne>);

            sinon.stub(User, 'findById').returns({
                select: sinon.stub().returnsThis(),
                lean: sinon.stub().resolves({ credentialVersion: 2 }),
            } as unknown as ReturnType<typeof User.findById>);

            try {
                await verifyAuthToken(token);
                expect.fail('Expected verifyAuthToken to throw for credential version mismatch');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(ApiError);
                if (err instanceof ApiError) {
                    expect(err.statusCode).to.equal(401);
                    expect(err.message).to.equal('Authentication token revoked');
                }
            }
        });

        it('should fail closed with 401 ApiError when user lookup throws unexpected database error', async () => {
            const userId = '507f1f77bcf86cd799439011';
            const token = signAuthToken(userId, 0);

            sinon.stub(TokenRevocation, 'findOne').returns({
                select: sinon.stub().returnsThis(),
                lean: sinon.stub().resolves(null),
            } as unknown as ReturnType<typeof TokenRevocation.findOne>);

            sinon.stub(User, 'findById').returns({
                select: sinon.stub().returnsThis(),
                lean: sinon.stub().rejects(new Error('Unexpected Mongo Database Connection Failure')),
            } as unknown as ReturnType<typeof User.findById>);

            try {
                await verifyAuthToken(token);
                expect.fail('Expected verifyAuthToken to fail closed on database lookup error');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(ApiError);
                if (err instanceof ApiError) {
                    expect(err.statusCode).to.equal(401);
                    expect(err.message).to.equal('Authentication failed');
                }
            }
        });

        it('should rethrow ApiError intact if user lookup throws an ApiError', async () => {
            const userId = '507f1f77bcf86cd799439011';
            const token = signAuthToken(userId, 0);

            sinon.stub(TokenRevocation, 'findOne').returns({
                select: sinon.stub().returnsThis(),
                lean: sinon.stub().resolves(null),
            } as unknown as ReturnType<typeof TokenRevocation.findOne>);

            sinon.stub(User, 'findById').returns({
                select: sinon.stub().returnsThis(),
                lean: sinon.stub().rejects(new ApiError('Custom ApiError', 401)),
            } as unknown as ReturnType<typeof User.findById>);

            try {
                await verifyAuthToken(token);
                expect.fail('Expected verifyAuthToken to rethrow ApiError');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(ApiError);
                if (err instanceof ApiError) {
                    expect(err.statusCode).to.equal(401);
                    expect(err.message).to.equal('Custom ApiError');
                }
            }
        });
    });
});
