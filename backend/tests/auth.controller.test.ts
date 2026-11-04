import 'mocha';
import { expect } from 'chai';
import request, { type Response as SupertestResponse } from 'supertest';
import { Types } from 'mongoose';
import sinon from 'sinon';
import app from '../src/app';
import User, { type UserDocument } from '../src/models/User';
import TokenRevocation from '../src/models/TokenRevocation';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { signAuthToken } from '../src/utils/jwt';

describe('Auth Controller & Routes (POST /api/auth/*)', () => {
    const validUserId = new Types.ObjectId('507f1f77bcf86cd799439011');

    afterEach(() => {
        sinon.restore();
    });

    describe('POST /api/auth/register', () => {
        it('should return 201 created on successful registration', async () => {
            const mockUser = {
                _id: validUserId,
                id: validUserId.toString(),
                email: 'test@example.com',
                name: 'Test User',
            };

            sinon.stub(User, 'findOne').returns({
                select: sinon.stub().returnsThis(),
                lean: sinon.stub().resolves(null),
            } as unknown as ReturnType<typeof User.findOne>);

            const createStub = sinon.stub(User, 'create') as unknown as sinon.SinonStub<[unknown], Promise<UserDocument>>;
            createStub.resolves(mockUser as unknown as UserDocument);

            let res: SupertestResponse;
            try {
                res = await request(app)
                    .post('/api/auth/register')
                    .send({
                        name: 'Test User',
                        email: 'test@example.com',
                        password: 'password123',
                    });
            } catch (err: unknown) {
                expect.fail(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(res.status).to.equal(201);
            expect(res.body.success).to.be.true;
            expect(res.body.data.user.email).to.equal('test@example.com');
            expect(res.body.data).to.have.property('token');
        });

        it('should return 400 bad request if request body is invalid or missing required fields', async () => {
            let res: SupertestResponse;
            try {
                res = await request(app)
                    .post('/api/auth/register')
                    .send({
                        email: 'test@example.com',
                    });
            } catch (err: unknown) {
                expect.fail(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(res.status).to.equal(400);
            expect(res.body.success).to.be.false;
        });

        it('should return 409 conflict if email is already in use', async () => {
            sinon.stub(User, 'findOne').returns({
                select: sinon.stub().returnsThis(),
                lean: sinon.stub().resolves({ _id: validUserId }),
            } as unknown as ReturnType<typeof User.findOne>);

            let res: SupertestResponse;
            try {
                res = await request(app)
                    .post('/api/auth/register')
                    .send({
                        name: 'Test User',
                        email: 'existing@example.com',
                        password: 'password123',
                    });
            } catch (err: unknown) {
                expect.fail(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(res.status).to.equal(409);
            expect(res.body).to.deep.equal({
                success: false,
                message: 'Email is already registered',
            });
        });
    });

    describe('POST /api/auth/login', () => {
        it('should return 200 OK with token on successful login', async () => {
            let hashedPassword = '';
            try {
                hashedPassword = await bcrypt.hash('password123', 10);
            } catch (error) {
                throw new Error('Failed to hash password during authentication test setup', {
                    cause: error,
                });
            }

            const mockUser = {
                _id: validUserId,
                id: validUserId.toString(),
                email: 'test@example.com',
                name: 'Test User',
                password: hashedPassword,
            };

            sinon.stub(User, 'findOne').returns({
                select: sinon.stub().resolves(mockUser),
            } as unknown as ReturnType<typeof User.findOne>);

            let res: SupertestResponse;
            try {
                res = await request(app)
                    .post('/api/auth/login')
                    .send({
                        email: 'test@example.com',
                        password: 'password123',
                    });
            } catch (err: unknown) {
                expect.fail(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(res.status).to.equal(200);
            expect(res.body.success).to.be.true;
            expect(res.body.data).to.have.property('token');
        });

        it('should return 401 unauthorized on wrong credentials', async () => {
            let hashedPassword = '';
            try {
                hashedPassword = await bcrypt.hash('realpassword123', 10);
            } catch (error) {
                throw new Error('Failed to hash password during authentication test setup', {
                    cause: error,
                });
            }

            const mockUser = {
                _id: validUserId,
                id: validUserId.toString(),
                email: 'test@example.com',
                name: 'Test User',
                password: hashedPassword,
            };

            sinon.stub(User, 'findOne').returns({
                select: sinon.stub().resolves(mockUser),
            } as unknown as ReturnType<typeof User.findOne>);

            let res: SupertestResponse;
            try {
                res = await request(app)
                    .post('/api/auth/login')
                    .send({
                        email: 'test@example.com',
                        password: 'wrongpassword',
                    });
            } catch (err: unknown) {
                expect.fail(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(res.status).to.equal(401);
            expect(res.body.message).to.equal('Invalid email or password');
        });
    });

    describe('GET /api/auth/me', () => {
        it('should return 401 unauthorized when Authorization header is missing', async () => {
            let res: SupertestResponse;
            try {
                res = await request(app).get('/api/auth/me');
            } catch (err: unknown) {
                expect.fail(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
            }
            expect(res.status).to.equal(401);
        });

        it('should return authenticated user profile when valid bearer token is provided', async () => {
            const mockUser = {
                _id: validUserId,
                id: validUserId.toString(),
                email: 'test@example.com',
                name: 'Test User',
            };

            // Register first to get valid JWT signed with actual secret
            sinon.stub(User, 'findOne').returns({
                select: sinon.stub().returnsThis(),
                lean: sinon.stub().resolves(null),
            } as unknown as ReturnType<typeof User.findOne>);
            
            const createStub = sinon.stub(User, 'create') as unknown as sinon.SinonStub<[unknown], Promise<UserDocument>>;
            createStub.resolves(mockUser as unknown as UserDocument);

            let regRes: SupertestResponse;
            try {
                regRes = await request(app)
                    .post('/api/auth/register')
                    .send({
                        name: 'Test User',
                        email: 'test@example.com',
                        password: 'password123',
                    });
            } catch (err: unknown) {
                expect.fail(`Registration setup request failed: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(regRes.status).to.equal(201, JSON.stringify(regRes.body));
            const token = regRes.body.data.token;
            sinon.restore();

            sinon.stub(TokenRevocation, 'findOne').returns({
                select: sinon.stub().returnsThis(),
                lean: sinon.stub().resolves(null),
            } as unknown as ReturnType<typeof TokenRevocation.findOne>);

            const queryObj = {
                select: sinon.stub().returnsThis(),
                lean: sinon.stub().resolves(mockUser),
                then: (resolve: (val: unknown) => void) => resolve(mockUser),
            };
            sinon.stub(User, 'findById').callsFake(() => queryObj as unknown as ReturnType<typeof User.findById>);

            let res: SupertestResponse;
            try {
                res = await request(app)
                    .get('/api/auth/me')
                    .set('Authorization', `Bearer ${token}`);
            } catch (err: unknown) {
                expect.fail(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(res.status).to.equal(200);
            expect(res.body.data.user.email).to.equal('test@example.com');
        });
    });

    describe('POST /api/auth/logout', () => {
        it('should perform logout when valid authorization header is supplied', async () => {
            const mockUser = {
                _id: validUserId,
                id: validUserId.toString(),
                email: 'test@example.com',
                name: 'Test User',
            };

            sinon.stub(User, 'findOne').returns({
                select: sinon.stub().returnsThis(),
                lean: sinon.stub().resolves(null),
            } as unknown as ReturnType<typeof User.findOne>);
            
            const createStub = sinon.stub(User, 'create') as unknown as sinon.SinonStub<[unknown], Promise<UserDocument>>;
            createStub.resolves(mockUser as unknown as UserDocument);

            let regRes: SupertestResponse;
            try {
                regRes = await request(app)
                    .post('/api/auth/register')
                    .send({
                        name: 'Test User',
                        email: 'test@example.com',
                        password: 'password123',
                    });
            } catch (err: unknown) {
                expect.fail(`Registration setup request failed: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(regRes.status).to.equal(201, JSON.stringify(regRes.body));
            const token = regRes.body.data.token;
            sinon.restore();

            const decoded = jwt.decode(token) as { jti: string; sub: string; exp: number } | null;
            expect(decoded).to.not.equal(null);
            const expectedTokenId = decoded!.jti;
            const expectedUserId = validUserId.toString();
            const expectedExpiresAt = new Date(decoded!.exp * 1000);

            sinon.stub(TokenRevocation, 'findOne').returns({
                select: sinon.stub().returnsThis(),
                lean: sinon.stub().resolves(null),
            } as unknown as ReturnType<typeof TokenRevocation.findOne>);
            const queryObj = {
                select: sinon.stub().returnsThis(),
                lean: sinon.stub().resolves(mockUser),
                then: (resolve: (val: unknown) => void) => resolve(mockUser),
            };
            sinon.stub(User, 'findById').callsFake(() => queryObj as unknown as ReturnType<typeof User.findById>);
            const findOneAndUpdateStub = sinon.stub(TokenRevocation, 'findOneAndUpdate').returns({
                exec: sinon.stub().resolves({}),
            } as unknown as ReturnType<typeof TokenRevocation.findOneAndUpdate>);

            let res: SupertestResponse;
            try {
                res = await request(app)
                    .post('/api/auth/logout')
                    .set('Authorization', `Bearer ${token}`);
            } catch (err: unknown) {
                expect.fail(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(res.status).to.equal(200);
            expect(res.body.message).to.equal('Logout successful');
            expect(findOneAndUpdateStub.calledOnce).to.be.true;
            expect(
                findOneAndUpdateStub.calledWith(
                    { jti: expectedTokenId },
                    {
                        $setOnInsert: {
                            expiresAt: expectedExpiresAt,
                            jti: expectedTokenId,
                            userId: expectedUserId,
                        },
                    },
                    {
                        upsert: true,
                        new: false,
                        setDefaultsOnInsert: true,
                    },
                ),
            ).to.be.true;
        });
    });

    describe('PUT /api/auth/profile', () => {
        it('should return 401 when unauthorized', async () => {
            try {
                const res = await request(app)
                    .put('/api/auth/profile')
                    .send({ name: 'New Name' });

                expect(res.status).to.equal(401);
                expect(res.body.success).to.be.false;
            } catch (err: unknown) {
                expect.fail(`Unauthorized profile request test failed: ${err instanceof Error ? err.message : String(err)}`);
            }
        });

        it('should update profile and return 200 with updated user when authorized', async () => {
            try {
                const token = signAuthToken(validUserId.toString());
                const mockUser = {
                    _id: validUserId,
                    id: validUserId.toString(),
                    email: 'updated@example.com',
                    name: 'Updated Name',
                    save: sinon.stub().resolves(),
                };

                sinon.stub(TokenRevocation, 'findOne').returns({
                    select: sinon.stub().returnsThis(),
                    lean: sinon.stub().resolves(null),
                } as unknown as ReturnType<typeof TokenRevocation.findOne>);

                const queryObj = {
                    select: sinon.stub().returnsThis(),
                    lean: sinon.stub().resolves(mockUser),
                    then: (resolve: (val: unknown) => void) => resolve(mockUser),
                };
                sinon.stub(User, 'findById').callsFake(() => queryObj as unknown as ReturnType<typeof User.findById>);

                sinon.stub(User, 'findOne').returns({
                    select: sinon.stub().returnsThis(),
                    lean: sinon.stub().resolves(null),
                } as unknown as ReturnType<typeof User.findOne>);

                const res = await request(app)
                    .put('/api/auth/profile')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        name: 'Updated Name',
                        email: 'updated@example.com',
                    });

                expect(res.status).to.equal(200);
                expect(res.body.success).to.be.true;
                expect(res.body.data.user).to.deep.equal({
                    id: validUserId.toString(),
                    name: 'Updated Name',
                    email: 'updated@example.com',
                });
            } catch (err: unknown) {
                expect.fail(`Authenticated profile update request test failed: ${err instanceof Error ? err.message : String(err)}`);
            }
        });
    });

    describe('PUT /api/auth/change-password', () => {
        it('should return 401 when unauthorized', async () => {
            try {
                const res = await request(app)
                    .put('/api/auth/change-password')
                    .send({
                        currentPassword: 'CurrentPass123!',
                        newPassword: 'NewPassword123!',
                    });

                expect(res.status).to.equal(401);
                expect(res.body.success).to.be.false;
            } catch (err: unknown) {
                expect.fail(`Unauthorized password-change request test failed: ${err instanceof Error ? err.message : String(err)}`);
            }
        });

        it('should return 200 when current password matches and new password is valid', async () => {
            try {
                const token = signAuthToken(validUserId.toString());
                const currentHash = await bcrypt.hash('CurrentPass123!', 10);
                const mockUser = {
                    _id: validUserId,
                    password: currentHash,
                    save: sinon.stub().resolves(),
                };

                sinon.stub(TokenRevocation, 'findOne').returns({
                    select: sinon.stub().returnsThis(),
                    lean: sinon.stub().resolves(null),
                } as unknown as ReturnType<typeof TokenRevocation.findOne>);

                const queryObj = {
                    select: sinon.stub().returnsThis(),
                    lean: sinon.stub().resolves(mockUser),
                    then: (resolve: (val: unknown) => void) => resolve(mockUser),
                };
                sinon.stub(User, 'findById').callsFake(() => queryObj as unknown as ReturnType<typeof User.findById>);
                sinon.stub(User, 'updateOne').resolves({
                    acknowledged: true,
                    matchedCount: 1,
                    modifiedCount: 1,
                    upsertedCount: 0,
                    upsertedId: null,
                } as Awaited<ReturnType<typeof User.updateOne>>);

                const res = await request(app)
                    .put('/api/auth/change-password')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        currentPassword: 'CurrentPass123!',
                        newPassword: 'NewStrongPassword123!',
                    });

                expect(res.status).to.equal(200);
                expect(res.body.success).to.be.true;
                expect(res.body.message).to.equal('Password changed successfully');
            } catch (err: unknown) {
                expect.fail(`Authenticated password-change request test failed: ${err instanceof Error ? err.message : String(err)}`);
            }
        });
    });
});
