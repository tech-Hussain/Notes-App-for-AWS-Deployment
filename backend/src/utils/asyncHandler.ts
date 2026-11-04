import type { ParsedQs } from 'qs';
import type { ParamsDictionary, RequestHandler } from 'express-serve-static-core';

export type AsyncRequestHandler<
    P extends ParamsDictionary = ParamsDictionary,
    ResBody = unknown,
    ReqBody = unknown,
    ReqQuery = ParsedQs,
    LocalsObj extends Record<string, unknown> = Record<string, unknown>,
> = (
    req: Parameters<RequestHandler<P, ResBody, ReqBody, ReqQuery, LocalsObj>>[0],
    res: Parameters<RequestHandler<P, ResBody, ReqBody, ReqQuery, LocalsObj>>[1],
    next: Parameters<RequestHandler<P, ResBody, ReqBody, ReqQuery, LocalsObj>>[2],
) => Promise<unknown>;

export function asyncHandler<
    P extends ParamsDictionary = ParamsDictionary,
    ResBody = unknown,
    ReqBody = unknown,
    ReqQuery = ParsedQs,
    LocalsObj extends Record<string, unknown> = Record<string, unknown>,
>(handler: AsyncRequestHandler<P, ResBody, ReqBody, ReqQuery, LocalsObj>): RequestHandler<P, ResBody, ReqBody, ReqQuery, LocalsObj> {
    return ((req, res, next) => {
        void Promise.resolve()
            .then(() => handler(req as Parameters<RequestHandler<P, ResBody, ReqBody, ReqQuery, LocalsObj>>[0], res, next))
            .catch(next);
    }) as RequestHandler<P, ResBody, ReqBody, ReqQuery, LocalsObj>;
}

export default asyncHandler;