import { asyncHandler, type AsyncRequestHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { createNote, deleteNote, getNoteById, getNotes, updateNote } from '../services/note.service';

type NoteParams = {
    readonly id: string;
};

type CreateNoteRequestBody = {
    readonly content: string;
    readonly title: string;
};

type UpdateNoteRequestBody = Partial<CreateNoteRequestBody>;

type NotesListQuery = {
    readonly limit?: string;
    readonly page?: string;
    readonly search?: string;
    readonly sortBy?: string;
    readonly sortOrder?: string;
};

import type { ParamsDictionary } from 'express-serve-static-core';

const createNoteHandler: AsyncRequestHandler<ParamsDictionary, unknown, CreateNoteRequestBody> = async (req, res) => {
    const userId = req.authenticatedUser?.userId;

    if (userId === undefined) {
        throw new ApiError('Authentication required', 401);
    }

    try {
        const note = await createNote(userId, req.body);

        return sendSuccess(res, 201, 'Note created successfully', {
            note,
        });
    } catch (error: unknown) {
        throw error;
    }
};

const listNotesHandler: AsyncRequestHandler<ParamsDictionary, unknown, unknown, NotesListQuery> = async (req, res) => {
    const userId = req.authenticatedUser?.userId;

    if (userId === undefined) {
        throw new ApiError('Authentication required', 401);
    }

    try {
        const result = await getNotes(userId, req.query);

        return sendSuccess(res, 200, 'Notes retrieved successfully', {
            limit: result.limit,
            notes: result.notes,
            page: result.page,
            total: result.total,
            totalPages: result.totalPages,
        });
    } catch (error: unknown) {
        throw error;
    }
};

const getNoteHandler: AsyncRequestHandler<NoteParams> = async (req, res) => {
    const userId = req.authenticatedUser?.userId;

    if (userId === undefined) {
        throw new ApiError('Authentication required', 401);
    }

    try {
        const note = await getNoteById(userId, req.params.id);

        return sendSuccess(res, 200, 'Note retrieved successfully', {
            note,
        });
    } catch (error: unknown) {
        throw error;
    }
};

const updateNoteHandler: AsyncRequestHandler<NoteParams, unknown, UpdateNoteRequestBody> = async (req, res) => {
    const userId = req.authenticatedUser?.userId;

    if (userId === undefined) {
        throw new ApiError('Authentication required', 401);
    }

    try {
        const note = await updateNote(userId, req.params.id, req.body);

        return sendSuccess(res, 200, 'Note updated successfully', {
            note,
        });
    } catch (error: unknown) {
        throw error;
    }
};

const deleteNoteHandler: AsyncRequestHandler<NoteParams> = async (req, res) => {
    const userId = req.authenticatedUser?.userId;

    if (userId === undefined) {
        throw new ApiError('Authentication required', 401);
    }

    try {
        const result = await deleteNote(userId, req.params.id);

        return sendSuccess(res, 200, 'Note deleted successfully', result);
    } catch (error: unknown) {
        throw error;
    }
};

export const createNoteController = asyncHandler(createNoteHandler);
export const deleteNoteController = asyncHandler(deleteNoteHandler);
export const getNoteController = asyncHandler(getNoteHandler);
export const listNotesController = asyncHandler(listNotesHandler);
export const updateNoteController = asyncHandler(updateNoteHandler);