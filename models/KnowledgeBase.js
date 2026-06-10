import mongoose from 'mongoose';

const KnowledgeBaseSchema = new mongoose.Schema(
  {
    textContent: {
      type: String,
      required: true,
    },
    embedding: {
      type: [Number],
      required: true,
    },
    subjectCategory: {
      type: String,
      required: true,
      index: true,
    },
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic',
      index: true,
      required: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export default mongoose.models.KnowledgeBase ||
  mongoose.model('KnowledgeBase', KnowledgeBaseSchema);
