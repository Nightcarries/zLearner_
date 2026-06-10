import mongoose from 'mongoose';

const FlashcardSchema = new mongoose.Schema(
  {
    front: {
      type: String,
      required: true,
    },
    back: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const TopicSchema = new mongoose.Schema(
  {
    learningId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Learning',
      required: [true, 'Parent Learning ID is required'],
    },
    title: {
      type: String,
      required: [true, 'Topic title is required'],
      trim: true,
    },
    orderIndex: {
      type: Number,
      required: true,
      default: 0,
    },
    contentMarkdown: {
      type: String,
      default: '',
    },
    flashcards: {
      type: [FlashcardSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast sidebar lookups: all topics for a learning, sorted by order
TopicSchema.index({ learningId: 1, orderIndex: 1 });

export default mongoose.models.Topic ||
  mongoose.model('Topic', TopicSchema);
