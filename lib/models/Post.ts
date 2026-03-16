import mongoose, { Schema, Document } from 'mongoose';

export interface IPost extends Document {
  user_id: mongoose.Types.ObjectId;
  raw_text: string;
  categories: string[];
  severity_index: number | null;
  /** Legacy label kept for backward-compat with existing documents */
  severity?: string | null;
  location_text?: string | null;
  is_anonymous: boolean;
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  } | null;
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
    categories: {
      type: [String],
      default: [],
    },
    severity_index: {
      type: Number,
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
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
      },
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

PostSchema.index({ location: '2dsphere' }, { sparse: true });

export const Post = mongoose.models.Post || mongoose.model<IPost>('Post', PostSchema);
