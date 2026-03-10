import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  auth0_id: string;
  email: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  age?: number | null;
  phone_number?: string | null;
  created_at: Date;
}

const UserSchema = new Schema<IUser>(
  {
    auth0_id: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      default: null,
    },
    first_name: {
      type: String,
      required: true,
      default: null,
      trim: true,
    },
    last_name: {
      type: String,
      required: true,
      default: null,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      default: null,
      trim: true,
    },
    age: {
      type: Number,
      required: true,
      default: null,
    },
    phone_number: {
      type: String,
      required: true,
      default: null,
      trim: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

UserSchema.index({ auth0_id: 1 }, { unique: true });
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index(
  { username: 1 },
  {
    unique: true,
    partialFilterExpression: {
      username: { $type: 'string' },
    },
  }
);

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);