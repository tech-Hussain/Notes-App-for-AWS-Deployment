import bcrypt from 'bcryptjs';

import { logger } from '../logger/logger';
import TokenRevocation from '../models/TokenRevocation';
import User, { type PublicUser } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { signAuthToken } from '../utils/jwt';

export type AuthCredentials = {
    readonly email: string;
    readonly password: string;
};

export type RegistrationInput = AuthCredentials & {
    readonly name: string;
};

export type AuthResult = {
    readonly token: string;
    readonly user: PublicUser;
};

const BCRYPT_SALT_ROUNDS = 12;
const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('dummy_password_never_matches_123', BCRYPT_SALT_ROUNDS);

function assertString(value: unknown, fieldName: string): asserts value is string {
    if (typeof value !== 'string') {
        throw new ApiError(`${fieldName} is required`, 400);
    }
}

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

function validateEmail(email: unknown): void {
    assertString(email, 'Email');

    if (!EMAIL_PATTERN.test(email)) {
        throw new ApiError('Invalid email address', 400);
    }
}

function validatePassword(password: unknown): void {
    assertString(password, 'Password');

    if (password.trim().length === 0) {
        throw new ApiError('Password is required', 400);
    }

    if (password.length < 8) {
        throw new ApiError('Password must be at least 8 characters long', 400);
    }
}

function validateName(name: unknown): string {
    assertString(name, 'Name');

    const normalizedName = name.trim();

    if (normalizedName.length === 0) {
        throw new ApiError('Name is required', 400);
    }

    return normalizedName;
}

function toPublicUser(user: { readonly _id: { toString(): string }; readonly email: string; readonly name: string }): PublicUser {
    return {
        email: user.email,
        id: user._id.toString(),
        name: user.name,
    };
}

function isDuplicateKeyError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
        return false;
    }

    const candidate = error as { code?: unknown };

    return candidate.code === 11000;
}

export async function register(input: RegistrationInput): Promise<AuthResult> {
    try {
        const name = validateName(input.name);
        validateEmail(input.email);
        const email = normalizeEmail(input.email);

        validatePassword(input.password);

        if (bcrypt.truncates(input.password)) {
            throw new ApiError('Password exceeds the maximum length supported by bcrypt', 400);
        }

        const existingUser = await User.findOne({ email }).select('_id').lean();

        if (existingUser !== null) {
            throw new ApiError('Email is already registered', 409);
        }

        const hashedPassword = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

        try {
            const user = await User.create({
                email,
                name,
                password: hashedPassword,
            });
            const token = signAuthToken(user.id, user.credentialVersion ?? 0);

            logger.info({ userId: user.id }, 'User registered successfully');

            return {
                token,
                user: toPublicUser(user),
            };
        } catch (error: unknown) {
            if (isDuplicateKeyError(error)) {
                throw new ApiError('Email is already registered', 409);
            }

            throw error;
        }
    } catch (error: unknown) {
        if (error instanceof ApiError) {
            throw error;
        }

        logger.error({ errorName: error instanceof Error ? error.name : 'UnknownError' }, 'Registration failed');
        throw new ApiError('Registration failed', 500);
    }
}

export async function login(input: AuthCredentials): Promise<AuthResult> {
    try {
        validateEmail(input.email);
        const email = normalizeEmail(input.email);

        validatePassword(input.password);

        const user = await User.findOne({ email }).select('+password');

        if (user === null) {
            await bcrypt.compare(input.password, DUMMY_PASSWORD_HASH);
            logger.warn({ reason: 'invalid_credentials' }, 'Authentication failed');
            throw new ApiError('Invalid email or password', 401);
        }

        const passwordMatches = await bcrypt.compare(input.password, user.password);

        if (!passwordMatches) {
            logger.warn({ reason: 'invalid_credentials', userId: user.id }, 'Authentication failed');
            throw new ApiError('Invalid email or password', 401);
        }

        const token = signAuthToken(user.id, user.credentialVersion ?? 0);

        logger.info({ userId: user.id }, 'User logged in successfully');

        return {
            token,
            user: toPublicUser(user),
        };
    } catch (error: unknown) {
        if (error instanceof ApiError) {
            throw error;
        }

        logger.error({ errorName: error instanceof Error ? error.name : 'UnknownError' }, 'Login failed');
        throw new ApiError('Login failed', 500);
    }
}

export async function logout(userId: string, tokenId: string, expiresAt?: Date): Promise<{ readonly userId: string }> {
    try {
        const user = await User.findById(userId);

        if (user === null) {
            throw new ApiError('Authenticated user not found', 401);
        }

        if (expiresAt === undefined || !(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime())) {
            throw new ApiError('Authentication token has no valid expiration', 401);
        }

        try {
            await TokenRevocation.findOneAndUpdate(
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
            ).exec();
        } catch (error: unknown) {
            if (isDuplicateKeyError(error)) {
                logger.info({ userId, tokenId }, 'Token already revoked');
            } else {
                throw error;
            }
        }

        logger.info({ userId }, 'User logged out successfully');

        return {
            userId,
        };
    } catch (error: unknown) {
        if (error instanceof ApiError) {
            throw error;
        }

        logger.error({ errorName: error instanceof Error ? error.name : 'UnknownError' }, 'Logout failed');
        throw new ApiError('Logout failed', 500);
    }
}

export async function getAuthenticatedUser(userId: string): Promise<PublicUser> {
    try {
        const user = await User.findById(userId);

        if (user === null) {
            throw new ApiError('Authenticated user not found', 401);
        }

        return toPublicUser(user);
    } catch (error: unknown) {
        if (error instanceof ApiError) {
            throw error;
        }

        logger.error({ errorName: error instanceof Error ? error.name : 'UnknownError' }, 'Authenticated user lookup failed');
        throw new ApiError('Authenticated user lookup failed', 500);
    }
}

export type UpdateProfileInput = {
    readonly email?: string;
    readonly name?: string;
};

export type ChangePasswordInput = {
    readonly currentPassword: string;
    readonly newPassword: string;
};

function applyNameUpdate(user: { name: string }, nameInput: string): boolean {
    const name = validateName(nameInput);
    user.name = name;
    return true;
}

async function applyEmailUpdate(
    user: { email: string },
    userId: string,
    emailInput: string,
): Promise<boolean> {
    validateEmail(emailInput);
    const normalizedEmail = normalizeEmail(emailInput);

    if (normalizedEmail === user.email) {
        return false;
    }

    try {
        const existingUser = await User.findOne({ email: normalizedEmail }).select('_id').lean();
        if (existingUser !== null && existingUser._id.toString() !== userId) {
            throw new ApiError('Email is already registered', 409);
        }
    } catch (error: unknown) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw error;
    }

    user.email = normalizedEmail;
    return true;
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<PublicUser> {
    try {
        const user = await User.findById(userId);

        if (user === null) {
            throw new ApiError('Authenticated user not found', 401);
        }

        let hasUpdates = false;

        if (input.name !== undefined) {
            hasUpdates = applyNameUpdate(user, input.name) || hasUpdates;
        }

        if (input.email !== undefined) {
            const emailUpdated = await applyEmailUpdate(user, userId, input.email);
            hasUpdates = emailUpdated || hasUpdates;
        }

        if (!hasUpdates) {
            throw new ApiError('At least one field (name or email) must be provided for update', 400);
        }

        await user.save();

        logger.info({ userId }, 'User profile updated successfully');

        return toPublicUser(user);
    } catch (error: unknown) {
        if (error instanceof ApiError) {
            throw error;
        }

        if (isDuplicateKeyError(error)) {
            throw new ApiError('Email is already registered', 409);
        }

        logger.error({ errorName: error instanceof Error ? error.name : 'UnknownError' }, 'Profile update failed');
        throw new ApiError('Profile update failed', 500);
    }
}

export async function changePassword(userId: string, input: ChangePasswordInput): Promise<{ token: string }> {
    try {
        assertString(input.currentPassword, 'Current password');
        if (input.currentPassword.trim().length === 0) {
            throw new ApiError('Current password is required', 400);
        }

        validatePassword(input.newPassword);

        if (bcrypt.truncates(input.newPassword)) {
            throw new ApiError('Password exceeds the maximum length supported by bcrypt', 400);
        }

        const user = await User.findById(userId).select('+password');

        if (user === null) {
            throw new ApiError('Authenticated user not found', 401);
        }

        const currentPasswordMatches = await bcrypt.compare(input.currentPassword, user.password);

        if (!currentPasswordMatches) {
            logger.warn({ reason: 'incorrect_current_password', userId }, 'Password change failed');
            throw new ApiError('Current password is incorrect', 401);
        }

        if (input.currentPassword === input.newPassword) {
            throw new ApiError('New password must be different from current password', 400);
        }

        const hashedNewPassword = await bcrypt.hash(input.newPassword, BCRYPT_SALT_ROUNDS);

        const currentCredentialVersion = user.credentialVersion ?? 0;
        const now = new Date();

        const updateResult = await User.updateOne(
            {
                _id: user._id,
                $or: [
                    { credentialVersion: currentCredentialVersion },
                    ...(currentCredentialVersion === 0 ? [{ credentialVersion: { $exists: false } }] : []),
                ],
            },
            {
                $set: {
                    credentialVersion: currentCredentialVersion + 1,
                    password: hashedNewPassword,
                    passwordChangedAt: now,
                },
            },
        );

        if (updateResult.matchedCount === 0) {
            logger.warn({ userId }, 'Concurrent password update conflict');
            throw new ApiError('Concurrent update detected. Please try again.', 409);
        }

        user.password = hashedNewPassword;
        user.credentialVersion = currentCredentialVersion + 1;
        user.passwordChangedAt = now;

        const token = signAuthToken(userId, user.credentialVersion);

        logger.info({ userId }, 'User password changed successfully');

        return { token };
    } catch (error: unknown) {
        if (error instanceof ApiError) {
            throw error;
        }

        logger.error({ errorName: error instanceof Error ? error.name : 'UnknownError' }, 'Password change failed');
        throw new ApiError('Password change failed', 500);
    }
}