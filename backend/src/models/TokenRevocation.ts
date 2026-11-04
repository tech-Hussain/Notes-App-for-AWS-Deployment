import { Schema, model, type HydratedDocument } from 'mongoose';

export type TokenRevocationAttributes = {
    readonly expiresAt: Date;
    readonly jti: string;
    readonly userId: string;
};

export type TokenRevocationDocument = HydratedDocument<TokenRevocationAttributes>;

const tokenRevocationSchema = new Schema<TokenRevocationAttributes>(
    {
        expiresAt: {
            expires: 0,
            index: true,
            required: true,
            type: Date,
        },
        jti: {
            index: true,
            required: true,
            trim: true,
            type: String,
            unique: true,
        },
        userId: {
            index: true,
            required: true,
            trim: true,
            type: String,
        },
    },
    {
        timestamps: true,
    },
);

export const TokenRevocation = model<TokenRevocationAttributes>('TokenRevocation', tokenRevocationSchema);

export default TokenRevocation;
