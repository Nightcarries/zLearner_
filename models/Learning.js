import mongoose from 'mongoose';

const LearningSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Learning title is required'],
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound index for fast per-user lookups
LearningSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.Learning ||
  mongoose.model('Learning', LearningSchema);
