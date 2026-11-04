import 'mocha';
import { expect } from 'chai';

describe('Deliberate failure (CI demo)', () => {
    it('fails on purpose so the PR check goes red', () => {
        expect(1).to.equal(2);
    });
});
