import { isValidObjectId } from 'mongoose';

import { logger } from '../logger/logger';
import Note, { type NoteDocument } from '../models/Note';
import { ApiError } from '../utils/ApiError';

export type CreateNoteInput = {
    readonly content: string;
    readonly title: string;
};

export type UpdateNoteInput = {
    readonly content?: string;
    readonly title?: string;
};

export type NotesQueryInput = {
    readonly limit?: string | number;
    readonly page?: string | number;
    readonly search?: string;
    readonly sortBy?: string;
    readonly sortOrder?: string;
};

export type NotesListResult = {
    readonly limit: number;
    readonly notes: NoteListItem[];
    readonly page: number;
    readonly total: number;
    readonly totalPages: number;
};

export type NoteListItem = {
    readonly _id: string;
    readonly content: string;
    readonly createdAt: Date;
    readonly title: string;
    readonly updatedAt: Date;
    readonly userId: string;
};

type NormalizedPagination = {
    readonly limit: number;
    readonly page: number;
};

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 100000;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const ALLOWED_SORT_FIELDS = ['createdAt', 'title', 'updatedAt'] as const;
const DEFAULT_SORT_BY = 'updatedAt';
const DEFAULT_SORT_ORDER = 'desc';

type AllowedSortField = (typeof ALLOWED_SORT_FIELDS)[number];
type SortDirection = 1 | -1;

function assertPlainObject(value: unknown, paramName = 'Request body'): asserts value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new ApiError(`${paramName} must be an object`, 400);
    }
}

function assertString(value: unknown, fieldName: string): asserts value is string {
    if (typeof value !== 'string') {
        throw new ApiError(`${fieldName} is required`, 400);
    }
}

function validateAuthenticatedUserId(userId: string): void {
    if (!isValidObjectId(userId)) {
        throw new ApiError('Authentication required', 401);
    }
}

function validateNoteId(noteId: string): void {
    if (!isValidObjectId(noteId)) {
        throw new ApiError('Invalid note ID', 400);
    }
}

function normalizeTitle(title: unknown): string {
    assertString(title, 'Title');

    const normalizedTitle = title.trim();

    if (normalizedTitle.length === 0) {
        throw new ApiError('Title is required', 400);
    }

    if (normalizedTitle.length > MAX_TITLE_LENGTH) {
        throw new ApiError(`Title must be at most ${MAX_TITLE_LENGTH} characters long`, 400);
    }

    return normalizedTitle;
}

function normalizeContent(content: unknown): string {
    assertString(content, 'Content');

    if (content.trim().length === 0) {
        throw new ApiError('Content is required', 400);
    }

    if (content.length > MAX_CONTENT_LENGTH) {
        throw new ApiError(`Content must be at most ${MAX_CONTENT_LENGTH} characters long`, 400);
    }

    return content;
}

function parsePositiveInteger(value: string | number | undefined, fieldName: string, defaultValue: number, maximum: number): number {
    if (value === undefined) {
        return defaultValue;
    }

    const numericValue = typeof value === 'number' ? value : Number(value.trim());

    if (typeof value === 'string' && !/^[0-9]+$/.test(value.trim())) {
        throw new ApiError(`${fieldName} must be a positive integer`, 400);
    }

    if (!Number.isInteger(numericValue) || numericValue <= 0) {
        throw new ApiError(`${fieldName} must be a positive integer`, 400);
    }

    if (numericValue > maximum) {
        throw new ApiError(`${fieldName} must be at most ${maximum}`, 400);
    }

    return numericValue;
}

function normalizePagination(input: NotesQueryInput): NormalizedPagination {
    return {
        limit: parsePositiveInteger(input.limit, 'Limit', DEFAULT_LIMIT, MAX_LIMIT),
        page: parsePositiveInteger(input.page, 'Page', DEFAULT_PAGE, Number.MAX_SAFE_INTEGER),
    };
}

function normalizeSortField(sortBy: string | undefined): AllowedSortField {
    if (sortBy === undefined || sortBy.trim().length === 0) {
        return DEFAULT_SORT_BY;
    }

    const normalizedSortBy = sortBy.trim();

    if (!ALLOWED_SORT_FIELDS.includes(normalizedSortBy as AllowedSortField)) {
        throw new ApiError('Invalid sortBy value', 400);
    }

    return normalizedSortBy as AllowedSortField;
}

function normalizeSortOrder(sortOrder: string | undefined): SortDirection {
    if (sortOrder === undefined || sortOrder.trim().length === 0) {
        return -1;
    }

    const normalizedSortOrder = sortOrder.trim().toLowerCase();

    if (normalizedSortOrder === 'asc') {
        return 1;
    }

    if (normalizedSortOrder === 'desc') {
        return -1;
    }

    throw new ApiError('Invalid sortOrder value', 400);
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildOwnershipFilter(userId: string, search?: string): Record<string, unknown> {
    const filter: Record<string, unknown> = {
        userId,
    };

    if (search !== undefined) {
        const normalizedSearch = search.trim();

        if (normalizedSearch.length > 0) {
            const searchPattern = new RegExp(escapeRegex(normalizedSearch), 'i');

            filter.$or = [
                { content: searchPattern },
                { title: searchPattern },
            ];
        }
    }

    return filter;
}

function toNoteQueryError(operation: string, error: unknown, context: Record<string, unknown>): never {
    if (error instanceof ApiError) {
        throw error;
    }

    logger.error(
        {
            ...context,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            errorName: error instanceof Error ? error.name : 'UnknownError',
        },
        operation,
    );

    throw new ApiError(`${operation} failed`, 500);
}

export async function createNote(userId: string, input: CreateNoteInput): Promise<NoteDocument> {
    try {
        validateAuthenticatedUserId(userId);
        assertPlainObject(input);

        const title = normalizeTitle(input.title);
        const content = normalizeContent(input.content);

        const note = await Note.create({
            content,
            title,
            userId,
        });

        logger.info({ noteId: note.id, userId }, 'Note created successfully');

        return note;
    } catch (error: unknown) {
        return toNoteQueryError('Note creation', error, { userId });
    }
}

export async function getNotes(userId: string, query: NotesQueryInput): Promise<NotesListResult> {
    try {
        validateAuthenticatedUserId(userId);

        const pagination = normalizePagination(query);
        const sortBy = normalizeSortField(query.sortBy);
        const sortOrder = normalizeSortOrder(query.sortOrder);
        const filter = buildOwnershipFilter(userId, query.search);
        const total = await Note.countDocuments(filter);
        const notes = (await Note.find(filter)
            .sort({ [sortBy]: sortOrder })
            .skip((pagination.page - 1) * pagination.limit)
            .limit(pagination.limit)
            .lean()
            .exec()) as unknown as NoteListItem[];

        return {
            limit: pagination.limit,
            notes,
            page: pagination.page,
            total,
            totalPages: total === 0 ? 0 : Math.ceil(total / pagination.limit),
        };
    } catch (error: unknown) {
        return toNoteQueryError('Note listing', error, { userId, query });
    }
}

export async function getNoteById(userId: string, noteId: string): Promise<NoteDocument> {
    try {
        validateAuthenticatedUserId(userId);
        validateNoteId(noteId);

        const note = await Note.findOne({
            _id: noteId,
            userId,
        }).exec();

        if (note === null) {
            throw new ApiError('Note not found', 404);
        }

        return note;
    } catch (error: unknown) {
        return toNoteQueryError('Note retrieval', error, { noteId, userId });
    }
}

export async function updateNote(userId: string, noteId: string, input: UpdateNoteInput): Promise<NoteDocument> {
    try {
        validateAuthenticatedUserId(userId);
        validateNoteId(noteId);
        assertPlainObject(input);

        const updates: { content?: string; title?: string } = {};

        if (input.title !== undefined) {
            updates.title = normalizeTitle(input.title);
        }

        if (input.content !== undefined) {
            updates.content = normalizeContent(input.content);
        }

        if (Object.keys(updates).length === 0) {
            throw new ApiError('At least one field must be provided for update', 400);
        }

        const note = await Note.findOneAndUpdate(
            {
                _id: noteId,
                userId,
            },
            {
                $set: updates,
            },
            {
                new: true,
                runValidators: true,
            },
        ).exec();

        if (note === null) {
            throw new ApiError('Note not found', 404);
        }

        logger.info({ noteId, userId }, 'Note updated successfully');

        return note;
    } catch (error: unknown) {
        return toNoteQueryError('Note update', error, { noteId, userId });
    }
}

export async function deleteNote(userId: string, noteId: string): Promise<{ readonly deleted: true; readonly noteId: string }> {
    try {
        validateAuthenticatedUserId(userId);
        validateNoteId(noteId);

        const note = await Note.findOneAndDelete({
            _id: noteId,
            userId,
        }).exec();

        if (note === null) {
            throw new ApiError('Note not found', 404);
        }

        logger.info({ noteId, userId }, 'Note deleted successfully');

        return {
            deleted: true,
            noteId,
        };
    } catch (error: unknown) {
        return toNoteQueryError('Note deletion', error, { noteId, userId });
    }
}