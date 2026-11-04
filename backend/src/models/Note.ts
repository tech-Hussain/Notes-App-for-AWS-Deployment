import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export type NoteAttributes = {
    readonly content: string;
    readonly title: string;
    readonly userId: Types.ObjectId;
};

export type NoteDocument = HydratedDocument<NoteAttributes>;

const noteSchema = new Schema<NoteAttributes>(
    {
        content: {
            required: true,
            type: String,
        },
        title: {
            required: true,
            trim: true,
            type: String,
        },
        userId: {
            ref: 'User',
            required: true,
            type: Schema.Types.ObjectId,
        },
    },
    {
        timestamps: true,
    },
);

noteSchema.index({ userId: 1, createdAt: -1 });
noteSchema.index({ userId: 1, updatedAt: -1 });

export const Note = model<NoteAttributes>('Note', noteSchema);

export default Note;