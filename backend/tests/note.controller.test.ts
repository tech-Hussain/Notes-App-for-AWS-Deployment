import 'mocha';
import { expect } from 'chai';
import request, { type Response as SupertestResponse } from 'supertest';
import { Types } from 'mongoose';
import sinon from 'sinon';
import app from '../src/app';
import User, { type UserDocument } from '../src/models/User';
import Note, { type NoteDocument } from '../src/models/Note';
import TokenRevocation from '../src/models/TokenRevocation';

describe('Note Controller & Routes (/api/notes)', () => {
    const validUserId = new Types.ObjectId('507f1f77bcf86cd799439011');
    const validNoteId = new Types.ObjectId('507f1f77bcf86cd799439022');
    let authToken = '';

    beforeEach(async () => {
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
        
        const createUserStub = sinon.stub(User, 'create') as unknown as sinon.SinonStub<[unknown], Promise<UserDocument>>;
        createUserStub.resolves(mockUser as unknown as UserDocument);

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
            expect.fail(`beforeEach setup request failed: ${err instanceof Error ? err.message : String(err)}`);
        }

        expect(regRes.status).to.equal(201, JSON.stringify(regRes.body));
        authToken = regRes.body.data.token;
        sinon.restore();

        sinon.stub(TokenRevocation, 'findOne').returns({
            select: sinon.stub().returnsThis(),
            lean: sinon.stub().resolves(null),
        } as unknown as ReturnType<typeof TokenRevocation.findOne>);

        sinon.stub(User, 'findById').returns({
            select: sinon.stub().returnsThis(),
            lean: sinon.stub().resolves({ _id: validUserId, credentialVersion: 0 }),
        } as unknown as ReturnType<typeof User.findById>);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('POST /api/notes', () => {
        it('should return 201 created with note data when creation succeeds', async () => {
            const mockNote = {
                _id: validNoteId,
                id: validNoteId.toString(),
                userId: validUserId.toString(),
                title: 'New Note',
                content: 'New Note Body',
            };

            const createNoteStub = sinon.stub(Note, 'create') as unknown as sinon.SinonStub<[unknown], Promise<NoteDocument>>;
            createNoteStub.resolves(mockNote as unknown as NoteDocument);

            let res: SupertestResponse;
            try {
                res = await request(app)
                    .post('/api/notes')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        title: 'New Note',
                        content: 'New Note Body',
                    });
            } catch (err: unknown) {
                expect.fail(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(res.status).to.equal(201);
            expect(res.body.success).to.be.true;
            expect(res.body.data.note.title).to.equal('New Note');
        });

        it('should return 401 when Authorization header is missing', async () => {
            let res: SupertestResponse;
            try {
                res = await request(app)
                    .post('/api/notes')
                    .send({ title: 'New Note', content: 'Body' });
            } catch (err: unknown) {
                expect.fail(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(res.status).to.equal(401);
        });
    });

    describe('GET /api/notes', () => {
        it('should return 200 OK with list of notes and pagination info', async () => {
            const mockNotes = [
                {
                    _id: validNoteId,
                    userId: validUserId.toString(),
                    title: 'Note 1',
                    content: 'Content 1',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            const countStub = sinon.stub(Note, 'countDocuments').resolves(1);
            const findStub = (sinon.stub(Note, 'find') as unknown as sinon.SinonStub).returns({
                sort: sinon.stub().returnsThis(),
                skip: sinon.stub().returnsThis(),
                limit: sinon.stub().returnsThis(),
                lean: sinon.stub().returnsThis(),
                exec: sinon.stub().resolves(mockNotes),
            });

            let res: SupertestResponse;
            try {
                res = await request(app)
                    .get('/api/notes')
                    .set('Authorization', `Bearer ${authToken}`);
            } catch (err: unknown) {
                expect.fail(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(countStub.firstCall.args[0]).to.deep.include({
                userId: validUserId.toString(),
            });
            expect(findStub.firstCall.args[0]).to.deep.include({
                userId: validUserId.toString(),
            });
            expect(res.status).to.equal(200);
            expect(res.body.data.notes).to.be.an('array').with.lengthOf(1);
            expect(res.body.data.total).to.equal(1);
        });
    });

    describe('GET /api/notes/:id', () => {
        it('should return 200 OK with single note by ID', async () => {
            const mockNote = {
                _id: validNoteId,
                userId: validUserId.toString(),
                title: 'Single Note',
                content: 'Content',
            };

            sinon.stub(Note, 'findOne').returns({
                exec: sinon.stub().resolves(mockNote),
            } as unknown as ReturnType<typeof Note.findOne>);

            let res: SupertestResponse;
            try {
                res = await request(app)
                    .get(`/api/notes/${validNoteId.toString()}`)
                    .set('Authorization', `Bearer ${authToken}`);
            } catch (err: unknown) {
                expect.fail(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(res.status).to.equal(200);
            expect(res.body.data.note.title).to.equal('Single Note');
        });

        it('should return 404 when note is not found', async () => {
            sinon.stub(Note, 'findOne').returns({
                exec: sinon.stub().resolves(null),
            } as unknown as ReturnType<typeof Note.findOne>);

            let res: SupertestResponse;
            try {
                res = await request(app)
                    .get(`/api/notes/${validNoteId.toString()}`)
                    .set('Authorization', `Bearer ${authToken}`);
            } catch (err: unknown) {
                expect.fail(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(res.status).to.equal(404);
            expect(res.body.message).to.equal('Note not found');
        });
    });

    describe('PUT /api/notes/:id', () => {
        it('should return 200 OK with updated note', async () => {
            const mockUpdatedNote = {
                _id: validNoteId,
                userId: validUserId.toString(),
                title: 'Updated Title',
                content: 'Updated Content',
            };

            sinon.stub(Note, 'findOneAndUpdate').returns({
                exec: sinon.stub().resolves(mockUpdatedNote),
            } as unknown as ReturnType<typeof Note.findOneAndUpdate>);

            let res: SupertestResponse;
            try {
                res = await request(app)
                    .put(`/api/notes/${validNoteId.toString()}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({ title: 'Updated Title' });
            } catch (err: unknown) {
                expect.fail(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(res.status).to.equal(200);
            expect(res.body.data.note.title).to.equal('Updated Title');
        });
    });

    describe('DELETE /api/notes/:id', () => {
        it('should return 200 OK when note deletion succeeds', async () => {
            const mockDeletedNote = {
                _id: validNoteId,
                userId: validUserId.toString(),
            };

            sinon.stub(Note, 'findOneAndDelete').returns({
                exec: sinon.stub().resolves(mockDeletedNote),
            } as unknown as ReturnType<typeof Note.findOneAndDelete>);

            let res: SupertestResponse;
            try {
                res = await request(app)
                    .delete(`/api/notes/${validNoteId.toString()}`)
                    .set('Authorization', `Bearer ${authToken}`);
            } catch (err: unknown) {
                expect.fail(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
            }

            expect(res.status).to.equal(200);
            expect(res.body.data.deleted).to.be.true;
        });
    });
});
