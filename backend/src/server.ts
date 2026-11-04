import type { Server } from 'node:http';

import app from './app';
import { disconnectDatabase, connectDatabase } from './config/database';
import { env } from './config/env';
import { logger } from './logger/logger';

let server: Server | undefined;
let shutdownPromise: Promise<void> | undefined;

async function startServer(): Promise<void> {
    try {
        await connectDatabase();

        await new Promise<void>((resolve, reject) => {
            server = app.listen(env.port, '0.0.0.0');

            const handleListening = (): void => {
                if (server !== undefined) {
                    server.off('error', handleError);
                }

                logger.info(
                    {
                        nodeEnv: env.nodeEnv,
                        port: env.port,
                    },
                    'Server started',
                );
                resolve();
            };

            const handleError = (error: Error): void => {
                if (server !== undefined) {
                    server.off('listening', handleListening);
                }

                reject(error);
            };

            server.once('listening', handleListening);
            server.once('error', handleError);
        });
    } catch (error: unknown) {
        logger.error(
            {
                errorMessage: error instanceof Error ? error.message : 'Unknown startup error',
                errorName: error instanceof Error ? error.name : 'UnknownError',
            },
            'Failed to start server',
        );
        process.exit(1);
    }
}

async function closeHttpServer(): Promise<void> {
    if (server === undefined) {
        return;
    }

    const currentServer = server;

    try {
        await new Promise<void>((resolve, reject) => {
            currentServer.close((error) => {
                if (error !== undefined) {
                    reject(error);
                    return;
                }

                resolve();
            });
        });
    } catch (error: unknown) {
        logger.error({ err: error }, 'HTTP server shutdown failed');
        throw error;
    }
}

async function shutdown(signal: string): Promise<void> {
    if (shutdownPromise !== undefined) {
        return shutdownPromise;
    }

    shutdownPromise = (async () => {
        logger.info({ signal }, 'Shutdown signal received');

        try {
            await closeHttpServer();
            await disconnectDatabase();
            logger.info({ signal }, 'Shutdown completed');
            process.exit(signal === 'uncaughtException' || signal === 'unhandledRejection' ? 1 : 0);
        } catch (error: unknown) {
            logger.error(
                {
                    errorMessage: error instanceof Error ? error.message : 'Unknown shutdown error',
                    errorName: error instanceof Error ? error.name : 'UnknownError',
                    signal,
                },
                'Shutdown failed',
            );
            process.exit(1);
        }
    })();

    return shutdownPromise;
}

process.on('SIGINT', () => {
    void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
});

process.on('unhandledRejection', (reason: unknown) => {
    logger.error(
        {
            errorMessage: reason instanceof Error ? reason.message : String(reason),
            errorName: reason instanceof Error ? reason.name : 'UnhandledRejection',
        },
        'Unhandled rejection detected',
    );
    void shutdown('unhandledRejection').catch((error: unknown) => {
        logger.error({ err: error }, 'Shutdown invocation failed');
        process.exit(1);
    });
});

process.on('uncaughtException', (error: Error) => {
    logger.error(
        {
            errorMessage: error.message,
            errorName: error.name,
        },
        'Uncaught exception detected',
    );
    void shutdown('uncaughtException').catch((shutdownError: unknown) => {
        logger.error({ err: shutdownError }, 'Shutdown invocation failed');
        process.exit(1);
    });
});

void startServer();