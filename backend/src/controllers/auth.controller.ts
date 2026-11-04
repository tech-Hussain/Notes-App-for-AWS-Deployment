import { ApiError } from '../utils/ApiError';
import { changePassword, getAuthenticatedUser, login, logout, register, updateProfile } from '../services/auth.service';
import { sendSuccess } from '../utils/ApiResponse';
import { asyncHandler, type AsyncRequestHandler } from '../utils/asyncHandler';

type RegisterRequestBody = {
    readonly email: string;
    readonly name: string;
    readonly password: string;
};

type LoginRequestBody = {
    readonly email: string;
    readonly password: string;
};

type UpdateProfileRequestBody = {
    readonly email?: string;
    readonly name?: string;
};

type ChangePasswordRequestBody = {
    readonly currentPassword: string;
    readonly newPassword: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateRegisterPayload(body: unknown): RegisterRequestBody {
    if (!isObject(body)) {
        throw new ApiError('Invalid request body', 400);
    }

    const { email, name, password } = body;

    if (typeof name !== 'string') {
        throw new ApiError('Invalid or missing name', 400);
    }

    if (typeof email !== 'string') {
        throw new ApiError('Invalid or missing email', 400);
    }

    if (typeof password !== 'string') {
        throw new ApiError('Invalid or missing password', 400);
    }

    return { email, name, password };
}

function validateLoginPayload(body: unknown): LoginRequestBody {
    if (!isObject(body)) {
        throw new ApiError('Invalid request body', 400);
    }

    const { email, password } = body;

    if (typeof email !== 'string') {
        throw new ApiError('Invalid or missing email', 400);
    }

    if (typeof password !== 'string') {
        throw new ApiError('Invalid or missing password', 400);
    }

    return { email, password };
}

function validateUpdateProfilePayload(body: unknown): UpdateProfileRequestBody {
    if (!isObject(body)) {
        throw new ApiError('Invalid request body', 400);
    }

    const { email, name } = body;

    if (email === undefined && name === undefined) {
        throw new ApiError('At least one field (name or email) must be provided for update', 400);
    }

    if (name !== undefined && typeof name !== 'string') {
        throw new ApiError('Name must be a string', 400);
    }

    if (email !== undefined && typeof email !== 'string') {
        throw new ApiError('Email must be a string', 400);
    }

    return {
        email: email as string | undefined,
        name: name as string | undefined,
    };
}

function validateChangePasswordPayload(body: unknown): ChangePasswordRequestBody {
    if (!isObject(body)) {
        throw new ApiError('Invalid request body', 400);
    }

    const { currentPassword, newPassword } = body;

    if (typeof currentPassword !== 'string' || currentPassword.trim().length === 0) {
        throw new ApiError('Current password is required', 400);
    }

    if (typeof newPassword !== 'string' || newPassword.trim().length === 0) {
        throw new ApiError('New password is required', 400);
    }

    return { currentPassword, newPassword };
}

import type { ParamsDictionary } from 'express-serve-static-core';

const registerHandler: AsyncRequestHandler<ParamsDictionary, unknown, RegisterRequestBody> = async (req, res) => {
    try {
        const payload = validateRegisterPayload(req.body);
        const result = await register(payload);

        return sendSuccess(res, 201, 'Registration successful', result);
    } catch (error: unknown) {
        throw error;
    }
};

const loginHandler: AsyncRequestHandler<ParamsDictionary, unknown, LoginRequestBody> = async (req, res) => {
    try {
        const payload = validateLoginPayload(req.body);
        const result = await login(payload);

        return sendSuccess(res, 200, 'Login successful', result);
    } catch (error: unknown) {
        throw error;
    }
};

const meHandler: AsyncRequestHandler = async (req, res) => {
    const userId = req.authenticatedUser?.userId;

    if (userId === undefined) {
        throw new ApiError('Authentication required', 401);
    }

    try {
        const user = await getAuthenticatedUser(userId);

        return sendSuccess(res, 200, 'Authenticated user retrieved successfully', {
            user,
        });
    } catch (error: unknown) {
        throw error;
    }
};

const updateProfileHandler: AsyncRequestHandler<ParamsDictionary, unknown, UpdateProfileRequestBody> = async (req, res) => {
    const userId = req.authenticatedUser?.userId;

    if (userId === undefined) {
        throw new ApiError('Authentication required', 401);
    }

    try {
        const payload = validateUpdateProfilePayload(req.body);
        const user = await updateProfile(userId, payload);

        return sendSuccess(res, 200, 'Profile updated successfully', {
            user,
        });
    } catch (error: unknown) {
        throw error;
    }
};

const changePasswordHandler: AsyncRequestHandler<ParamsDictionary, unknown, ChangePasswordRequestBody> = async (req, res) => {
    const userId = req.authenticatedUser?.userId;

    if (userId === undefined) {
        throw new ApiError('Authentication required', 401);
    }

    try {
        const payload = validateChangePasswordPayload(req.body);
        const result = await changePassword(userId, payload);

        return sendSuccess(res, 200, 'Password changed successfully', result);
    } catch (error: unknown) {
        throw error;
    }
};

const logoutHandler: AsyncRequestHandler = async (req, res) => {
    const userId = req.authenticatedUser?.userId;
    const tokenId = req.authenticatedUser?.tokenId;
    const expiresAt = req.authenticatedUser?.expiresAt;

    if (userId === undefined || tokenId === undefined) {
        throw new ApiError('Authentication required', 401);
    }

    try {
        const result = await logout(userId, tokenId, expiresAt);

        return sendSuccess(res, 200, 'Logout successful', result);
    } catch (error: unknown) {
        throw error;
    }
};

export const registerUser = asyncHandler(registerHandler);
export const loginUser = asyncHandler(loginHandler);
export const logoutUser = asyncHandler(logoutHandler);
export const getAuthenticatedUserController = asyncHandler(meHandler);
export const updateProfileController = asyncHandler(updateProfileHandler);
export const changePasswordController = asyncHandler(changePasswordHandler);