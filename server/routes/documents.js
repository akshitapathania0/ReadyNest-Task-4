const express = require('express');
const router = express.Router();
const Document = require('../models/Document');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

function canAccess(doc, uid) {
  if (doc.isPublic) return true;
  const ownerId = doc.owner?._id ? doc.owner._id.toString() : doc.owner.toString();
  if (ownerId === uid) return true;
  return doc.collaborators.some(c => {
    const cid = c.user?._id ? c.user._id.toString() : c.user.toString();
    return cid === uid;
  });
}

function canEdit(doc, uid) {
  const ownerId = doc.owner?._id ? doc.owner._id.toString() : doc.owner.toString();
  if (ownerId === uid) return true;
  const collab = doc.collaborators.find(c => {
    const cid = c.user?._id ? c.user._id.toString() : c.user.toString();
    return cid === uid;
  });
  return collab && collab.role === 'editor';
}

// Get all documents
router.get('/', authenticate, async (req, res) => {
  try {
    const docs = await Document.find({
      $or: [
        { owner: req.user._id },
        { 'collaborators.user': req.user._id },
        { isPublic: true }
      ]
    })
      .populate('owner', 'username color avatar')
      .populate('collaborators.user', 'username color avatar')
      .sort({ updatedAt: -1 })
      .select('-versions -activities -chatMessages');
    res.json({ documents: docs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create document
router.post('/', authenticate, async (req, res) => {
  try {
    const doc = new Document({
      title: req.body.title || 'Untitled Document',
      owner: req.user._id,
      isPublic: req.body.isPublic || false,
      versions: [{ content: '', savedBy: req.user._id, message: 'Initial version', charCount: 0 }],
      activities: [{ userId: req.user._id, username: req.user.username, action: 'created', detail: 'Document created' }]
    });
    await doc.save();
    await doc.populate('owner', 'username color avatar');
    res.status(201).json({ document: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single document
router.get('/:id', authenticate, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id)
      .populate('owner', 'username color avatar')
      .populate('collaborators.user', 'username color avatar');
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (!canAccess(doc, req.user._id.toString())) return res.status(403).json({ error: 'Access denied' });
    res.json({ document: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update document
router.put('/:id', authenticate, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!canEdit(doc, req.user._id.toString())) return res.status(403).json({ error: 'No edit permission' });

    const { title, content, isPublic, saveVersion, versionMessage } = req.body;
    if (title !== undefined) doc.title = title;
    if (content !== undefined) doc.content = content;
    if (isPublic !== undefined) doc.isPublic = isPublic;
    doc.lastEditedBy = req.user._id;

    if (saveVersion) {
      doc.versions.push({
        content: doc.content,
        savedBy: req.user._id,
        message: versionMessage || `Saved by ${req.user.username}`,
        charCount: (doc.content || '').length
      });
      if (doc.versions.length > 50) doc.versions = doc.versions.slice(-50);
    }
    await doc.save();
    res.json({ document: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete document
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const ownerId = doc.owner?._id ? doc.owner._id.toString() : doc.owner.toString();
    if (ownerId !== req.user._id.toString()) return res.status(403).json({ error: 'Only owner can delete' });
    await doc.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add collaborator
router.post('/:id/collaborators', authenticate, async (req, res) => {
  try {
    const { email, role } = req.body;
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const ownerId = doc.owner?._id ? doc.owner._id.toString() : doc.owner.toString();
    if (ownerId !== req.user._id.toString()) return res.status(403).json({ error: 'Only owner can add collaborators' });

    const targetUser = await User.findOne({ email });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    if (targetUser._id.toString() === req.user._id.toString()) return res.status(400).json({ error: 'Cannot add yourself' });

    const existing = doc.collaborators.find(c => {
      const cid = c.user?._id ? c.user._id.toString() : c.user.toString();
      return cid === targetUser._id.toString();
    });
    if (existing) {
      existing.role = role || 'editor';
    } else {
      doc.collaborators.push({ user: targetUser._id, role: role || 'editor' });
    }
    doc.activities.push({
      userId: req.user._id, username: req.user.username,
      action: 'added_collaborator', detail: `Added ${targetUser.username} as ${role || 'editor'}`
    });
    await doc.save();
    await doc.populate('collaborators.user', 'username color avatar email');
    res.json({ document: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Change collaborator role
router.put('/:id/collaborators/:userId/role', authenticate, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['editor', 'viewer'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const ownerId = doc.owner?._id ? doc.owner._id.toString() : doc.owner.toString();
    if (ownerId !== req.user._id.toString()) return res.status(403).json({ error: 'Only owner can change roles' });

    const collab = doc.collaborators.find(c => {
      const cid = c.user?._id ? c.user._id.toString() : c.user.toString();
      return cid === req.params.userId;
    });
    if (!collab) return res.status(404).json({ error: 'Collaborator not found' });

    collab.role = role;
    doc.activities.push({
      userId: req.user._id, username: req.user.username,
      action: 'changed_role', detail: `Changed collaborator role to ${role}`
    });
    await doc.save();
    await doc.populate('collaborators.user', 'username color avatar email');
    res.json({ document: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove collaborator
router.delete('/:id/collaborators/:userId', authenticate, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const ownerId = doc.owner?._id ? doc.owner._id.toString() : doc.owner.toString();
    if (ownerId !== req.user._id.toString()) return res.status(403).json({ error: 'Only owner can remove collaborators' });
    doc.collaborators = doc.collaborators.filter(c => {
      const cid = c.user?._id ? c.user._id.toString() : c.user.toString();
      return cid !== req.params.userId;
    });
    await doc.save();
    res.json({ message: 'Removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get version history
router.get('/:id/versions', authenticate, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id).populate('versions.savedBy', 'username color');
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!canAccess(doc, req.user._id.toString())) return res.status(403).json({ error: 'Access denied' });
    res.json({ versions: [...doc.versions].reverse() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Restore version
router.post('/:id/versions/:versionId/restore', authenticate, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!canEdit(doc, req.user._id.toString())) return res.status(403).json({ error: 'No edit permission' });

    const version = doc.versions.id(req.params.versionId);
    if (!version) return res.status(404).json({ error: 'Version not found' });

    // Snapshot current before restoring
    doc.versions.push({
      content: doc.content, savedBy: req.user._id,
      message: `Before restore by ${req.user.username}`, charCount: (doc.content || '').length
    });
    doc.content = version.content;
    doc.lastEditedBy = req.user._id;
    doc.activities.push({
      userId: req.user._id, username: req.user.username,
      action: 'restored_version', detail: `Restored version from ${new Date(version.savedAt).toLocaleString()}`
    });
    await doc.save();
    res.json({ document: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get activity log
router.get('/:id/activity', authenticate, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!canAccess(doc, req.user._id.toString())) return res.status(403).json({ error: 'Access denied' });
    res.json({ activities: [...doc.activities].slice(-100).reverse() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get chat history
router.get('/:id/chat', authenticate, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!canAccess(doc, req.user._id.toString())) return res.status(403).json({ error: 'Access denied' });
    res.json({ messages: (doc.chatMessages || []).slice(-200) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;