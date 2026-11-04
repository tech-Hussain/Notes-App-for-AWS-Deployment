import dotenv from 'dotenv';

dotenv.config();

export type NodeEnvironment = 'development' | 'production' | 'test';

export const LOG_LEVELS = [
    'fatal',
    'error',
    'warn',
    'info',
    'debug',
    'trace',
    'silent',
] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export type AppEnvironment = {
    readonly jwtSecret: string;
    readonly logLevel: LogLevel;
    readonly mongoUri: string;
    readonly nodeEnv: NodeEnvironment;
    readonly port: number;
};

const DEFAULT_LOG_LEVEL = 'info';
const DEFAULT_PORT = 5000;
const DEVELOPMENT_JWT_SECRET = 'development-jwt-secret';
const DEVELOPMENT_MONGO_URI = 'mongodb://127.0.0.1:27017/notes-app';
const EXAMPLE_JWT_SECRETS = new Set([
    'development-jwt-secret',
    'change-me-in-development',
    'jwt-secret',
    'secret',
]);

function parseNodeEnv(value: string | undefined): NodeEnvironment {
    if (value === undefined || value.trim() === '') {
        return 'development';
    }

    const normalizedValue = value.trim();

    switch (normalizedValue) {
        case 'development':
        case 'production':
        case 'test':
            return normalizedValue;
        default:
            throw new Error(`Invalid NODE_ENV value: ${value}`);
    }
}

function parsePort(value: string | undefined): number {
    if (value === undefined || value.trim() === '') {
        return DEFAULT_PORT;
    }

    if (!/^[0-9]+$/.test(value)) {
        throw new Error(`Invalid PORT value: ${value}`);
    }

    const port = Number(value);

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`PORT must be an integer between 1 and 65535. Received: ${value}`);
    }

    return port;
}

function parseLogLevel(value: string | undefined): LogLevel {
    if (value === undefined || value.trim() === '') {
        return DEFAULT_LOG_LEVEL;
    }

    const normalizedLevel = value.trim();

    switch (normalizedLevel) {
        case 'fatal':
        case 'error':
        case 'warn':
        case 'info':
        case 'debug':
        case 'trace':
        case 'silent':
            return normalizedLevel;
        default:
            throw new Error(`Invalid LOG_LEVEL value: ${value}`);
    }
}

function parseMongoUri(value: string | undefined, nodeEnv: NodeEnvironment): string {
    if (value !== undefined && value.trim() !== '') {
        return value.trim();
    }

    if (nodeEnv === 'development' || nodeEnv === 'test') {
        return DEVELOPMENT_MONGO_URI;
    }

    throw new Error('MONGODB_URI is required outside development');
}

function parseJwtSecret(value: string | undefined, nodeEnv: NodeEnvironment): string {
    if (value !== undefined && value.trim() !== '') {
        const normalizedValue = value.trim();

        if (nodeEnv !== 'development') {
            if (EXAMPLE_JWT_SECRETS.has(normalizedValue.toLowerCase()) || normalizedValue.length < 32) {
                throw new Error('JWT_SECRET must be configured with a strong secret outside development');
            }
        }

        return normalizedValue;
    }

    if (nodeEnv === 'development' || nodeEnv === 'test') {
        return DEVELOPMENT_JWT_SECRET;
    }

    throw new Error('JWT_SECRET is required outside development');
}

const nodeEnv = parseNodeEnv(process.env.NODE_ENV);

const env: AppEnvironment = {
    jwtSecret: parseJwtSecret(process.env.JWT_SECRET, nodeEnv),
    logLevel: parseLogLevel(process.env.LOG_LEVEL),
    mongoUri: parseMongoUri(process.env.MONGODB_URI, nodeEnv),
    nodeEnv,
    port: parsePort(process.env.PORT),
};

export { env };
export default env;