import type { Response } from 'express';

export type SuccessApiResponse<TData> = {
    readonly data?: TData;
    readonly message: string;
    readonly success: true;
};

export type ErrorApiResponse = {
    readonly message: string;
    readonly success: false;
};

export type ApiResponse<TData> = SuccessApiResponse<TData> | ErrorApiResponse;

export function sendSuccess<TData>(
    res: Response,
    statusCode: number,
    message: string,
    data?: TData,
): Response<SuccessApiResponse<TData>> {
    const payload: SuccessApiResponse<TData> =
        data === undefined
            ? {
                  message,
                  success: true,
              }
            : {
                  data,
                  message,
                  success: true,
              };

    return res.status(statusCode).json(payload);
}

export function sendError(res: Response, statusCode: number, message: string): Response<ErrorApiResponse> {
    const payload: ErrorApiResponse = {
        message,
        success: false,
    };

    return res.status(statusCode).json(payload);
}