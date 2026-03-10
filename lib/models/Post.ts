import mongoose, { Schema, Document } from 'mongoose';

export interface IPost extends Document {
  user_id: mongoose.Types.ObjectId;
  raw_text: string;
  category?: string | null;
  severity?: string | null;
  location_text?: string | null;
  is_anonymous: boolean;
  latitude?: number | null;
  longitude?: number | null;
  created_at: Date;
}

const PostSchema = new Schema<IPost>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    raw_text: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      default: null,
    },
    severity: {
      type: String,
      default: null,
    },
    location_text: {
      type: String,
      default: null,
    },
    is_anonymous: {
      type: Boolean,
      default: false,
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

export const Post = mongoose.models.Post || mongoose.model<IPost>('Post', PostSchema);
