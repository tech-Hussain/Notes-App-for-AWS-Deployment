import mongoose from 'mongoose';

import { env } from './env';
import { logger } from '../logger/logger';

export async function connectDatabase(): Promise<typeof mongoose> {
    if (mongoose.connection.readyState === 1) {
        return mongoose;
    }

    try {
        const connection = await mongoose.connect(env.mongoUri);
        logger.info('MongoDB connected successfully');
        return connection;
    } catch (error: unknown) {
        logger.error(
            {
                errorMessage: error instanceof Error ? error.message : 'Unknown MongoDB connection error',
                errorName: error instanceof Error ? error.name : 'UnknownError',
            },
            'MongoDB connection failed',
        );
        throw error instanceof Error ? error : new Error('MongoDB connection failed');
    }
}

export async function disconnectDatabase(): Promise<void> {
    if (mongoose.connection.readyState === 0) {
        return;
    }

    try {
        await mongoose.disconnect();
    } catch (error: unknown) {
        logger.error({ err: error }, 'Database disconnect failed');
        throw error;
    }
}