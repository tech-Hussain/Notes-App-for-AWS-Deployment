import 'mocha';
import { expect } from 'chai';
import type { NextFunction, Request, Response } from 'express';
import sinon from 'sinon';
import errorHandler from '../src/middleware/errorHandler';
import { logger } from '../src/logger/logger';
import { ApiError } from '../src/utils/ApiError';

describe('Error Handler Middleware (errorHandler.ts)', () => {
    let req: Partial<Request>;
    let res: Partial<Response> & { status: sinon.SinonStub; json: sinon.SinonStub };
    let next: sinon.SinonStub;

    beforeEach(() => {
        req = {
            method: 'GET',
            path: '/test-route',
        };
        res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub().returnsThis(),
        };
        next = sinon.stub();
    });

    afterEach(() => {
        sinon.restore();
    });

    it('should format ApiError correctly without logging error-level details', () => {
        const loggerErrorSpy = sinon.spy(logger, 'error');
        const apiErr = new ApiError('Resource not found', 404);

        errorHandler(apiErr, req as Request, res as Response, next as NextFunction);

        expect(res.status.calledWith(404)).to.be.true;
        expect(res.json.calledWith({
            success: false,
            message: 'Resource not found',
        })).to.be.true;
        expect(loggerErrorSpy.called).to.be.false;
    });

    it('should handle unexpected errors safely returning status 500 and log the error details', () => {
        const loggerErrorSpy = sinon.spy(logger, 'error');
        const unexpectedError = new Error('Database connection lost');

        errorHandler(unexpectedError, req as Request, res as Response, next as NextFunction);

        expect(res.status.calledWith(500)).to.be.true;
        expect(res.json.calledWith({
            success: false,
            message: 'Internal server error',
        })).to.be.true;
        expect(loggerErrorSpy.calledOnce).to.be.true;
        expect(loggerErrorSpy.firstCall.args[0]).to.deep.include({
            errorMessage: 'Database connection lost',
            errorName: 'Error',
            method: 'GET',
            pathname: '/test-route',
            statusCode: 500,
        });
    });

    it('should handle unknown non-Error objects safely', () => {
        const loggerErrorSpy = sinon.spy(logger, 'error');
        const nonError = 'Something broke string error';

        errorHandler(nonError, req as Request, res as Response, next as NextFunction);

        expect(res.status.calledWith(500)).to.be.true;
        expect(res.json.calledWith({
            success: false,
            message: 'Internal server error',
        })).to.be.true;
        expect(loggerErrorSpy.calledOnce).to.be.true;
        expect(loggerErrorSpy.firstCall.args[0]).to.deep.include({
            errorMessage: 'Unknown error',
            errorName: 'UnknownError',
        });
    });
});
