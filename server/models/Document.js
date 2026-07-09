const mongoose = require('mongoose');

const versionSchema = new mongoose.Schema({
  content: { type: String, default: '' },
  savedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  savedAt: { type: Date, default: Date.now },
  message: { type: String, default: 'Auto-save' },
  charCount: { type: Number, default: 0 }
});

const activitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username: String,
  action: String,
  detail: String,
  timestamp: { type: Date, default: Date.now }
});

const chatMessageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username: String,
  color: String,
  message: String,
  timestamp: { type: Date, default: Date.now }
});

const documentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    default: 'Untitled Document'
  },
  content: {
    type: String,
    default: ''
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  collaborators: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['viewer', 'editor'], default: 'editor' },
    addedAt: { type: Date, default: Date.now }
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  versions: [versionSchema],
  activities: [activitySchema],
  chatMessages: [chatMessageSchema],
  tags: [String],
  lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

documentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Document', documentSchema);