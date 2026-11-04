import 'mocha';
import { expect } from 'chai';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import sinon from 'sinon';
import User, { type PublicUser, type UserDocument } from '../src/models/User';
import TokenRevocation from '../src/models/TokenRevocation';
import { ApiError } from '../src/utils/ApiError';
import * as authService from '../src/services/auth.service';

describe('Auth Service (auth.service.ts)', () => {
    const validUserId = new Types.ObjectId('507f1f77bcf86cd799439011');

    afterEach(() => {
        sinon.restore();
    });

    describe('register', () => {
        it('should register a new user successfully and return token and public user profile', async () => {
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

            let result: authService.AuthResult;
            try {
                result = await authService.register({
                    name: 'Test User',
                    email: 'test@example.com',
                    password: 'password123',
                });
            } catch (err: unknown) {
                expect.fail(`authService.register rejected unexpectedly: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(result).to.have.property('token').that.is.a('string');
            expect(result.user).to.deep.equal({
                id: validUserId.toString(),
                name: 'Test User',
                email: 'test@example.com',
            });
        });

        it('should throw 409 conflict error when email is already registered', async () => {
            sinon.stub(User, 'findOne').returns({
                select: sinon.stub().returnsThis(),
                lean: sinon.stub().resolves({ _id: validUserId }),
            } as unknown as ReturnType<typeof User.findOne>);

            try {
                await authService.register({
                    name: 'Test User',
                    email: 'existing@example.com',
                    password: 'password123',
                });
                expect.fail('Expected register to throw ApiError');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(ApiError);
                if (err instanceof ApiError) {
                    expect(err.statusCode).to.equal(409);
                    expect(err.message).to.equal('Email is already registered');
                }
            }
        });

        it('should throw 400 validation error for invalid email or password too short', async () => {
            try {
                await authService.register({
                    name: 'Test User',
                    email: 'invalid-email',
                    password: 'short',
                });
                expect.fail('Expected register to throw ApiError');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(ApiError);
                if (err instanceof ApiError) {
                    expect(err.statusCode).to.equal(400);
                    expect(err.message).to.equal('Invalid email address');
                }
            }
        });

        it('should throw 400 validation error when name is empty', async () => {
            try {
                await authService.register({
                    name: '   ',
                    email: 'test@example.com',
                    password: 'password123',
                });
                expect.fail('Expected register to throw ApiError');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(ApiError);
                if (err instanceof ApiError) {
                    expect(err.statusCode).to.equal(400);
                    expect(err.message).to.equal('Name is required');
                }
            }
        });
    });

    describe('login', () => {
        it('should authenticate valid credentials and return token and user profile', async () => {
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

            let result: authService.AuthResult;
            try {
                result = await authService.login({
                    email: 'test@example.com',
                    password: 'password123',
                });
            } catch (err: unknown) {
                expect.fail(`authService.login rejected unexpectedly: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(result.token).to.be.a('string');
            expect(result.user.email).to.equal('test@example.com');
        });

        it('should throw 401 for non-existent user email', async () => {
            sinon.stub(User, 'findOne').returns({
                select: sinon.stub().resolves(null),
            } as unknown as ReturnType<typeof User.findOne>);

            try {
                await authService.login({
                    email: 'unknown@example.com',
                    password: 'password123',
                });
                expect.fail('Expected login to throw ApiError');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(ApiError);
                if (err instanceof ApiError) {
                    expect(err.statusCode).to.equal(401);
                    expect(err.message).to.equal('Invalid email or password');
                }
            }
        });

        it('should throw 401 for incorrect password', async () => {
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

            try {
                await authService.login({
                    email: 'test@example.com',
                    password: 'wrongpassword',
                });
                expect.fail('Expected login to throw ApiError');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(ApiError);
                if (err instanceof ApiError) {
                    expect(err.statusCode).to.equal(401);
                    expect(err.message).to.equal('Invalid email or password');
                }
            }
        });
    });

    describe('logout', () => {
        it('should revoke token and return userId when successful', async () => {
            const userId = validUserId.toString();
            const tokenId = 'test-token-uuid';
            const expiresAt = new Date(Date.now() + 3600000);

            sinon.stub(User, 'findById').resolves({ _id: validUserId } as unknown as UserDocument);
            const findOneAndUpdateStub = sinon.stub(TokenRevocation, 'findOneAndUpdate').returns({
                exec: sinon.stub().resolves({}),
            } as unknown as ReturnType<typeof TokenRevocation.findOneAndUpdate>);

            let result: { readonly userId: string };
            try {
                result = await authService.logout(userId, tokenId, expiresAt);
            } catch (err: unknown) {
                expect.fail(`authService.logout rejected unexpectedly: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(findOneAndUpdateStub.calledOnce).to.be.true;
            expect(
                findOneAndUpdateStub.calledWith(
                    { jti: tokenId },
                    {
                        $setOnInsert: {
                            expiresAt,
                            jti: tokenId,
                            userId,
                        },
                    },
                    {
                        upsert: true,
                        new: false,
                        setDefaultsOnInsert: true,
                    },
                ),
            ).to.be.true;
            expect(result).to.deep.equal({ userId });
        });

        it('should throw 401 if user does not exist', async () => {
            sinon.stub(User, 'findById').resolves(null);

            try {
                await authService.logout(validUserId.toString(), 'token-id', new Date());
                expect.fail('Expected logout to throw');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(ApiError);
                if (err instanceof ApiError) {
                    expect(err.statusCode).to.equal(401);
                }
            }
        });
    });

    describe('getAuthenticatedUser', () => {
        it('should return public user profile when user exists', async () => {
            const mockUser = {
                _id: validUserId,
                email: 'test@example.com',
                name: 'Test User',
            };

            sinon.stub(User, 'findById').resolves(mockUser as unknown as UserDocument);

            let user: PublicUser;
            try {
                user = await authService.getAuthenticatedUser(validUserId.toString());
            } catch (err: unknown) {
                expect.fail(`authService.getAuthenticatedUser rejected unexpectedly: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(user).to.deep.equal({
                id: validUserId.toString(),
                email: 'test@example.com',
                name: 'Test User',
            });
        });

        it('should throw 401 when user is not found', async () => {
            sinon.stub(User, 'findById').resolves(null);

            try {
                await authService.getAuthenticatedUser(validUserId.toString());
                expect.fail('Expected getAuthenticatedUser to throw');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(ApiError);
                if (err instanceof ApiError) {
                    expect(err.statusCode).to.equal(401);
                }
            }
        });
    });

    describe('updateProfile', () => {
        it('should update user name and email successfully and return updated public profile', async () => {
            try {
                const mockUser = {
                    _id: validUserId,
                    id: validUserId.toString(),
                    email: 'old@example.com',
                    name: 'Old Name',
                    save: sinon.stub().resolves(),
                };

                sinon.stub(User, 'findById').resolves(mockUser as unknown as UserDocument);
                sinon.stub(User, 'findOne').returns({
                    select: sinon.stub().returnsThis(),
                    lean: sinon.stub().resolves(null),
                } as unknown as ReturnType<typeof User.findOne>);

                const result = await authService.updateProfile(validUserId.toString(), {
                    name: 'New Name',
                    email: 'new@example.com',
                });

                expect(mockUser.name).to.equal('New Name');
                expect(mockUser.email).to.equal('new@example.com');
                expect(mockUser.save.calledOnce).to.be.true;
                expect(result).to.deep.equal({
                    id: validUserId.toString(),
                    name: 'New Name',
                    email: 'new@example.com',
                });
            } catch (err: unknown) {
                expect.fail(`updateProfile success test failed: ${err instanceof Error ? err.message : String(err)}`);
            }
        });

        it('should throw 409 when new email is already taken by another user', async () => {
            const mockUser = {
                _id: validUserId,
                id: validUserId.toString(),
                email: 'old@example.com',
                name: 'Old Name',
                save: sinon.stub().resolves(),
            };

            sinon.stub(User, 'findById').resolves(mockUser as unknown as UserDocument);
            sinon.stub(User, 'findOne').returns({
                select: sinon.stub().returnsThis(),
                lean: sinon.stub().resolves({ _id: new Types.ObjectId('507f1f77bcf86cd799439099') }),
            } as unknown as ReturnType<typeof User.findOne>);

            try {
                await authService.updateProfile(validUserId.toString(), {
                    email: 'taken@example.com',
                });
                expect.fail('Expected updateProfile to throw');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(ApiError);
                if (err instanceof ApiError) {
                    expect(err.statusCode).to.equal(409);
                    expect(err.message).to.equal('Email is already registered');
                }
            }
        });

        it('should throw 400 when neither name nor email is provided', async () => {
            const mockUser = {
                _id: validUserId,
                email: 'test@example.com',
                name: 'Test User',
                save: sinon.stub().resolves(),
            };

            sinon.stub(User, 'findById').resolves(mockUser as unknown as UserDocument);

            try {
                await authService.updateProfile(validUserId.toString(), {});
                expect.fail('Expected updateProfile to throw');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(ApiError);
                if (err instanceof ApiError) {
                    expect(err.statusCode).to.equal(400);
                }
            }
        });

        it('should not query for duplicate email when provided email is identical to current email', async () => {
            try {
                const mockUser = {
                    _id: validUserId,
                    id: validUserId.toString(),
                    email: 'same@example.com',
                    name: 'Old Name',
                    save: sinon.stub().resolves(),
                };

                sinon.stub(User, 'findById').resolves(mockUser as unknown as UserDocument);
                const findOneStub = sinon.stub(User, 'findOne');

                const result = await authService.updateProfile(validUserId.toString(), {
                    name: 'New Name',
                    email: 'same@example.com',
                });

                expect(findOneStub.called).to.be.false;
                expect(mockUser.name).to.equal('New Name');
                expect(mockUser.save.calledOnce).to.be.true;
                expect(result.name).to.equal('New Name');
            } catch (err: unknown) {
                expect.fail(`updateProfile test failed: ${err instanceof Error ? err.message : String(err)}`);
            }
        });
    });

    describe('changePassword', () => {
        it('should successfully update password when current password is valid and new password meets policy', async () => {
            try {
                const currentHashed = await bcrypt.hash('CurrentPass123!', 10);
                const mockUser = {
                    _id: validUserId,
                    password: currentHashed,
                    credentialVersion: 0,
                    passwordChangedAt: undefined as Date | undefined,
                };

                sinon.stub(User, 'findById').returns({
                    select: sinon.stub().resolves(mockUser),
                } as unknown as ReturnType<typeof User.findById>);

                const updateStub = sinon.stub(User, 'updateOne').resolves({
                    acknowledged: true,
                    matchedCount: 1,
                    modifiedCount: 1,
                    upsertedCount: 0,
                    upsertedId: null,
                } as Awaited<ReturnType<typeof User.updateOne>>);

                const result = await authService.changePassword(validUserId.toString(), {
                    currentPassword: 'CurrentPass123!',
                    newPassword: 'NewStrongPassword456!',
                });

                expect(result).to.have.property('token').that.is.a('string');
                expect(updateStub.calledOnce).to.be.true;
                expect(mockUser.credentialVersion).to.equal(1);
                expect(mockUser.passwordChangedAt).to.be.an.instanceOf(Date);
                const matchesNew = await bcrypt.compare('NewStrongPassword456!', mockUser.password);
                expect(matchesNew).to.be.true;
            } catch (err: unknown) {
                expect.fail(`changePassword success test failed: ${err instanceof Error ? err.message : String(err)}`);
            }
        });

        it('should throw 401 when current password is incorrect', async () => {
            const currentHashed = await bcrypt.hash('CorrectPassword123!', 10);
            const mockUser = {
                _id: validUserId,
                password: currentHashed,
                save: sinon.stub().resolves(),
            };

            sinon.stub(User, 'findById').returns({
                select: sinon.stub().resolves(mockUser),
            } as unknown as ReturnType<typeof User.findById>);

            try {
                await authService.changePassword(validUserId.toString(), {
                    currentPassword: 'WrongPassword123!',
                    newPassword: 'NewStrongPassword456!',
                });
                expect.fail('Expected changePassword to throw');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(ApiError);
                if (err instanceof ApiError) {
                    expect(err.statusCode).to.equal(401);
                    expect(err.message).to.equal('Current password is incorrect');
                }
            }
        });

        it('should throw 400 when new password is too short', async () => {
            try {
                await authService.changePassword(validUserId.toString(), {
                    currentPassword: 'CurrentPassword123!',
                    newPassword: 'short',
                });
                expect.fail('Expected changePassword to throw');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(ApiError);
                if (err instanceof ApiError) {
                    expect(err.statusCode).to.equal(400);
                }
            }
        });

        it('should throw 400 when new password is same as current password', async () => {
            const currentHashed = await bcrypt.hash('CurrentPass123!', 10);
            const mockUser = {
                _id: validUserId,
                password: currentHashed,
                save: sinon.stub().resolves(),
            };

            sinon.stub(User, 'findById').returns({
                select: sinon.stub().resolves(mockUser),
            } as unknown as ReturnType<typeof User.findById>);

            try {
                await authService.changePassword(validUserId.toString(), {
                    currentPassword: 'CurrentPass123!',
                    newPassword: 'CurrentPass123!',
                });
                expect.fail('Expected changePassword to throw');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(ApiError);
                if (err instanceof ApiError) {
                    expect(err.statusCode).to.equal(400);
                    expect(err.message).to.equal('New password must be different from current password');
                }
            }
        });

        it('should throw 409 conflict error when concurrent update occurs during password change', async () => {
            try {
                const currentHashed = await bcrypt.hash('CurrentPass123!', 10);
                const mockUser = {
                    _id: validUserId,
                    password: currentHashed,
                    credentialVersion: 0,
                };

                sinon.stub(User, 'findById').returns({
                    select: sinon.stub().resolves(mockUser),
                } as unknown as ReturnType<typeof User.findById>);

                sinon.stub(User, 'updateOne').resolves({
                    acknowledged: true,
                    matchedCount: 0,
                    modifiedCount: 0,
                    upsertedCount: 0,
                    upsertedId: null,
                } as Awaited<ReturnType<typeof User.updateOne>>);

                await authService.changePassword(validUserId.toString(), {
                    currentPassword: 'CurrentPass123!',
                    newPassword: 'NewStrongPassword456!',
                });
                expect.fail('Expected changePassword to throw 409 ApiError');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(ApiError);
                if (err instanceof ApiError) {
                    expect(err.statusCode).to.equal(409);
                    expect(err.message).to.equal('Concurrent update detected. Please try again.');
                }
            }
        });
    });
});
