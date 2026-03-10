import mongoose, { Document, Schema } from 'mongoose';

export interface IFollow extends Document {
  follower_id: mongoose.Types.ObjectId;
  following_id: mongoose.Types.ObjectId;
  created_at: Date;
}

const FollowSchema = new Schema<IFollow>(
  {
    follower_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    following_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

FollowSchema.index({ follower_id: 1, following_id: 1 }, { unique: true });
FollowSchema.index({ follower_id: 1 });
FollowSchema.index({ following_id: 1 });

export const Follow = mongoose.models.Follow || mongoose.model<IFollow>('Follow', FollowSchema);