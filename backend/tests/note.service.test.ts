import 'mocha';
import { expect } from 'chai';
import { Types } from 'mongoose';
import sinon from 'sinon';
import Note, { type NoteDocument } from '../src/models/Note';
import { ApiError } from '../src/utils/ApiError';
import * as noteService from '../src/services/note.service';

describe('Note Service (note.service.ts)', () => {
    const validUserId = new Types.ObjectId('507f1f77bcf86cd799439011').toString();
    const validNoteId = new Types.ObjectId('507f1f77bcf86cd799439022').toString();

    afterEach(() => {
        sinon.restore();
    });

    describe('createNote', () => {
        it('should create a new note when provided with valid input and user ID', async () => {
            const mockCreatedNote = {
                _id: validNoteId,
                id: validNoteId,
                userId: validUserId,
                title: 'My Test Note',
                content: 'Some test note content',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const createStub = sinon.stub(Note, 'create') as unknown as sinon.SinonStub<[unknown], Promise<NoteDocument>>;
            createStub.resolves(mockCreatedNote as unknown as NoteDocument);

            let result: NoteDocument;
            try {
                result = await noteService.createNote(validUserId, {
                    title: 'My Test Note',
                    content: 'Some test note content',
                });
            } catch (err: unknown) {
                expect.fail(`noteService.createNote rejected unexpectedly: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(result.title).to.equal('My Test Note');
            expect(result.content).to.equal('Some test note content');
        });

        it('should throw 401 if userId is invalid Mongo ObjectId', async () => {
            try {
                await noteService.createNote('invalid-user-id', {
                    title: 'Title',
                    content: 'Content',
                });
                expect.fail('Expected createNote to throw ApiError');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(ApiError);
                if (err instanceof ApiError) {
                    expect(err.statusCode).to.equal(401);
                    expect(err.message).to.equal('Authentication required');
                }
            }
        });

        it('should throw 400 if title is empty or missing', async () => {
            try {
                await noteService.createNote(validUserId, {
                    title: '   ',
                    content: 'Content',
                });
                expect.fail('Expected createNote to throw ApiError');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(ApiError);
                if (err instanceof ApiError) {
                    expect(err.statusCode).to.equal(400);
                    expect(err.message).to.equal('Title is required');
                }
            }
        });
    });

    describe('getNotes', () => {
        it('should fetch user notes with default pagination, sorting, and count total', async () => {
            const mockNotes = [
                { _id: validNoteId, title: 'Note 1', content: 'Content 1', userId: validUserId },
            ];

            const countStub = sinon.stub(Note, 'countDocuments').resolves(1);
            const findStub = (sinon.stub(Note, 'find') as unknown as sinon.SinonStub).returns({
                sort: sinon.stub().returnsThis(),
                skip: sinon.stub().returnsThis(),
                limit: sinon.stub().returnsThis(),
                lean: sinon.stub().returnsThis(),
                exec: sinon.stub().resolves(mockNotes),
            });

            let result: Awaited<ReturnType<typeof noteService.getNotes>>;
            try {
                result = await noteService.getNotes(validUserId, {});
            } catch (err: unknown) {
                expect.fail(`noteService.getNotes rejected unexpectedly: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(countStub.firstCall.args[0]).to.deep.include({
                userId: validUserId,
            });
            expect(findStub.firstCall.args[0]).to.deep.include({
                userId: validUserId,
            });
            expect(result.total).to.equal(1);
            expect(result.notes).to.deep.equal(mockNotes);
            expect(result.page).to.equal(1);
            expect(result.limit).to.equal(10);
            expect(result.totalPages).to.equal(1);
        });

        it('should filter user notes by search keyword', async () => {
            const countStub = sinon.stub(Note, 'countDocuments').resolves(0);
            const findStub = (sinon.stub(Note, 'find') as unknown as sinon.SinonStub).returns({
                sort: sinon.stub().returnsThis(),
                skip: sinon.stub().returnsThis(),
                limit: sinon.stub().returnsThis(),
                lean: sinon.stub().returnsThis(),
                exec: sinon.stub().resolves([]),
            });

            try {
                await noteService.getNotes(validUserId, { search: 'keyword' });
            } catch (err: unknown) {
                expect.fail(`noteService.getNotes rejected unexpectedly: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(countStub.firstCall.args[0]).to.deep.include({
                userId: validUserId,
            });
            expect(findStub.firstCall.args[0]).to.deep.include({
                userId: validUserId,
            });
            expect(countStub.firstCall.args[0]).to.have.property('$or');
            expect(findStub.firstCall.args[0]).to.have.property('$or');
        });
    });

    describe('getNoteById', () => {
        it('should return note document if note exists and belongs to user', async () => {
            const mockNote = {
                _id: validNoteId,
                userId: validUserId,
                title: 'Existing Note',
                content: 'Body content',
            };

            const findOneStub = sinon.stub(Note, 'findOne').returns({
                exec: sinon.stub().resolves(mockNote),
            } as unknown as ReturnType<typeof Note.findOne>);

            let note: NoteDocument;
            try {
                note = await noteService.getNoteById(validUserId, validNoteId);
            } catch (err: unknown) {
                expect.fail(`noteService.getNoteById rejected unexpectedly: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(findOneStub.firstCall.args[0]).to.deep.include({
                _id: validNoteId,
                userId: validUserId,
            });
            expect(note).to.deep.equal(mockNote);
        });

        it('should throw 404 if note is not found or owned by another user', async () => {
            sinon.stub(Note, 'findOne').returns({
                exec: sinon.stub().resolves(null),
            } as unknown as ReturnType<typeof Note.findOne>);

            try {
                await noteService.getNoteById(validUserId, validNoteId);
                expect.fail('Expected getNoteById to throw');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(ApiError);
                if (err instanceof ApiError) {
                    expect(err.statusCode).to.equal(404);
                    expect(err.message).to.equal('Note not found');
                }
            }
        });
    });

    describe('updateNote', () => {
        it('should update note title and content successfully', async () => {
            const updatedMockNote = {
                _id: validNoteId,
                userId: validUserId,
                title: 'Updated Title',
                content: 'Updated Content',
            };

            const findOneAndUpdateStub = sinon.stub(Note, 'findOneAndUpdate').returns({
                exec: sinon.stub().resolves(updatedMockNote),
            } as unknown as ReturnType<typeof Note.findOneAndUpdate>);

            let note: NoteDocument;
            try {
                note = await noteService.updateNote(validUserId, validNoteId, {
                    title: 'Updated Title',
                    content: 'Updated Content',
                });
            } catch (err: unknown) {
                expect.fail(`noteService.updateNote rejected unexpectedly: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(findOneAndUpdateStub.firstCall.args[0]).to.deep.include({
                _id: validNoteId,
                userId: validUserId,
            });
            expect(note.title).to.equal('Updated Title');
        });

        it('should throw 400 if no fields are provided for update', async () => {
            try {
                await noteService.updateNote(validUserId, validNoteId, {});
                expect.fail('Expected updateNote to throw');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(ApiError);
                if (err instanceof ApiError) {
                    expect(err.statusCode).to.equal(400);
                    expect(err.message).to.equal('At least one field must be provided for update');
                }
            }
        });
    });

    describe('deleteNote', () => {
        it('should delete existing note and return deleted result object', async () => {
            const mockDeletedNote = { _id: validNoteId, userId: validUserId };

            const findOneAndDeleteStub = sinon.stub(Note, 'findOneAndDelete').returns({
                exec: sinon.stub().resolves(mockDeletedNote),
            } as unknown as ReturnType<typeof Note.findOneAndDelete>);

            let result: { deleted: boolean; noteId: string };
            try {
                result = await noteService.deleteNote(validUserId, validNoteId);
            } catch (err: unknown) {
                expect.fail(`noteService.deleteNote rejected unexpectedly: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(findOneAndDeleteStub.firstCall.args[0]).to.deep.include({
                _id: validNoteId,
                userId: validUserId,
            });
            expect(result).to.deep.equal({ deleted: true, noteId: validNoteId });
        });

        it('should throw 404 if note to delete does not exist', async () => {
            sinon.stub(Note, 'findOneAndDelete').returns({
                exec: sinon.stub().resolves(null),
            } as unknown as ReturnType<typeof Note.findOneAndDelete>);

            try {
                await noteService.deleteNote(validUserId, validNoteId);
                expect.fail('Expected deleteNote to throw');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(ApiError);
                if (err instanceof ApiError) {
                    expect(err.statusCode).to.equal(404);
                }
            }
        });
    });
});
