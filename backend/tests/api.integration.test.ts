import 'mocha';
import { expect } from 'chai';
import mongoose from 'mongoose';
import request from 'supertest';

import app from '../src/app';

// Uses a dedicated throw-away database; it is dropped after the run.
const TEST_MONGO_URI = process.env.MONGODB_URI_TEST ?? 'mongodb://127.0.0.1:27017/notes_test';

const user = { email: 'integration@example.com', name: 'Integration User', password: 'Str0ng!Passw0rd#1' };

describe('API integration (real MongoDB)', () => {
    let token = '';
    let noteId = '';

    before(async () => {
        await mongoose.connect(TEST_MONGO_URI);
        await mongoose.connection.dropDatabase();
    });

    after(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
    });

    it('GET /api/health returns 200 with db up', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).to.equal(200);
        expect(res.body.data).to.include({ db: 'up', status: 'ok' });
    });

    it('registers a user and returns a token', async () => {
        const res = await request(app).post('/api/auth/register').send(user);
        expect(res.status).to.equal(201);
        expect(res.body.data.token).to.be.a('string');
    });

    it('logs in and returns a token', async () => {
        const res = await request(app).post('/api/auth/login').send({ email: user.email, password: user.password });
        expect(res.status).to.equal(200);
        token = res.body.data.token as string;
        expect(token).to.be.a('string');
    });

    it('creates a note (201)', async () => {
        const res = await request(app)
            .post('/api/notes')
            .set('Authorization', `Bearer ${token}`)
            .send({ content: 'body', title: 'first' });
        expect(res.status).to.equal(201);
        noteId = res.body.data.note._id as string;
    });

    it('lists notes and contains the new one', async () => {
        const res = await request(app).get('/api/notes').set('Authorization', `Bearer ${token}`);
        expect(res.status).to.equal(200);
        const ids = (res.body.data.notes as Array<{ _id: string }>).map((n) => n._id);
        expect(ids).to.include(noteId);
    });

    it('updates the note', async () => {
        const res = await request(app)
            .put(`/api/notes/${noteId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ content: 'changed', title: 'edited' });
        expect(res.status).to.equal(200);
        expect(res.body.data.note.title).to.equal('edited');
    });

    it('deletes the note', async () => {
        const res = await request(app).delete(`/api/notes/${noteId}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).to.equal(200);
    });

    it('rejects requests without a token (401)', async () => {
        const res = await request(app).get('/api/notes');
        expect(res.status).to.equal(401);
    });
});
