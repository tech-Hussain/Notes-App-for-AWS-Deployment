import { Schema, model, type HydratedDocument } from 'mongoose';

export type UserAttributes = {
    email: string;
    name: string;
    password: string;
    passwordChangedAt?: Date;
    credentialVersion: number;
};

export type UserDocument = HydratedDocument<
    UserAttributes
>;

export type PublicUser = {
    readonly email: string;
    readonly id: string;
    readonly name: string;
};

const userSchema = new Schema<UserAttributes>(
    {
        email: {
            required: true,
            trim: true,
            type: String,
            unique: true,
            lowercase: true,
        },
        name: {
            required: true,
            trim: true,
            type: String,
        },
        password: {
            required: true,
            select: false,
            type: String,
        },
        passwordChangedAt: {
            type: Date,
        },
        credentialVersion: {
            default: 0,
            required: true,
            type: Number,
        },
    },
    {
        timestamps: true,
    },
);

export const User = model<UserAttributes>('User', userSchema);

export default User;