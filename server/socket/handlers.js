const Document = require('../models/Document');

const activeDocuments = new Map();
const saveTimers = new Map();

function getDocumentState(docId) {
  if (!activeDocuments.has(docId)) {
    activeDocuments.set(docId, {
      users: new Map(),
      content: null,
      version: 0,
      lastActivityContent: null
    });
  }
  return activeDocuments.get(docId);
}

function broadcastActiveUsers(io, docId) {
  const state = activeDocuments.get(docId);
  if (!state) return;
  const users = Array.from(state.users.values()).map(u => ({
    userId: u.userId, username: u.username,
    color: u.color, cursor: u.cursor, socketId: u.socketId
  }));
  io.to(docId).emit('active_users', users);
}

function getDiffSummary(oldContent, newContent) {
  const diff = (newContent || '').length - (oldContent || '').length;
  if (Math.abs(diff) < 10) return null; // ignore tiny changes
  const oldWords = (oldContent || '').trim().split(/\s+/).filter(Boolean).length;
  const newWords = (newContent || '').trim().split(/\s+/).filter(Boolean).length;
  const wordDiff = newWords - oldWords;
  let parts = [];
  if (diff > 0) parts.push(`added ${diff} characters`);
  else parts.push(`removed ${Math.abs(diff)} characters`);
  if (wordDiff > 0) parts.push(`${wordDiff} words added`);
  else if (wordDiff < 0) parts.push(`${Math.abs(wordDiff)} words removed`);
  return parts.join(', ');
}

function scheduleSave(io, docId, userId, username) {
  if (saveTimers.has(docId)) clearTimeout(saveTimers.get(docId));
  const timer = setTimeout(async () => {
    const state = activeDocuments.get(docId);
    if (!state || state.content === null) return;
    try {
      const doc = await Document.findById(docId);
      if (!doc) return;

      const summary = getDiffSummary(state.lastActivityContent, state.content);
      doc.content = state.content;
      doc.lastEditedBy = userId;

      if (summary) {
        doc.activities.push({ userId, username, action: 'edited', detail: `Edited — ${summary}` });
        if (doc.activities.length > 200) doc.activities = doc.activities.slice(-200);
        state.lastActivityContent = state.content;
      }

      // Auto-create a version every save if content changed significantly
      const lastVersion = doc.versions[doc.versions.length - 1];
      const lastContent = lastVersion ? lastVersion.content : '';
      const charDiff = Math.abs((state.content || '').length - (lastContent || '').length);
      if (charDiff > 50) {
        doc.versions.push({
          content: state.content,
          savedBy: userId,
          message: `Auto-saved by ${username}`,
          charCount: state.content.length
        });
        if (doc.versions.length > 50) doc.versions = doc.versions.slice(-50);
        io.to(docId).emit('version_saved', {
          message: `Auto-saved`, savedBy: username,
          timestamp: new Date().toISOString()
        });
      }

      await doc.save();
      io.to(docId).emit('auto_saved', { timestamp: new Date().toISOString() });
    } catch (e) {
      console.error('Auto-save error:', e);
    }
    saveTimers.delete(docId);
  }, 5000);
  saveTimers.set(docId, timer);
}

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`👤 ${user.username} connected [${socket.id}]`);

    socket.on('join_document', async ({ documentId }) => {
      try {
        const doc = await Document.findById(documentId)
          .populate('owner', 'username color')
          .populate('collaborators.user', 'username color');
        if (!doc) return socket.emit('error', { message: 'Document not found' });

        const uid = user._id.toString();
        const ownerId = doc.owner?._id ? doc.owner._id.toString() : doc.owner.toString();
        const isOwner = ownerId === uid;
        const isCollab = doc.collaborators.some(c => {
          const cid = c.user?._id ? c.user._id.toString() : c.user.toString();
          return cid === uid;
        });
        if (!doc.isPublic && !isOwner && !isCollab) {
          return socket.emit('error', { message: 'Access denied' });
        }

        socket.join(documentId);
        socket.currentDocId = documentId;

        const state = getDocumentState(documentId);
        if (state.content === null) {
          state.content = doc.content || '';
          state.lastActivityContent = doc.content || '';
        }

        state.users.set(socket.id, {
          socketId: socket.id, userId: uid,
          username: user.username, color: user.color, cursor: null
        });

        socket.emit('document_state', {
          content: state.content, version: state.version, title: doc.title
        });

        socket.to(documentId).emit('notification', {
          type: 'user_joined', message: `${user.username} joined`,
          user: { username: user.username, color: user.color }
        });

        doc.activities.push({
          userId: user._id, username: user.username,
          action: 'joined', detail: `${user.username} opened the document`
        });
        await doc.save();

        broadcastActiveUsers(io, documentId);
      } catch (err) {
        console.error('join_document error:', err);
        socket.emit('error', { message: 'Failed to join document' });
      }
    });

    socket.on('content_update', async ({ documentId, content, title }) => {
      const state = activeDocuments.get(documentId);
      if (!state) return;

      if (content !== undefined) {
        state.content = content;
        state.version++;
      }

      socket.to(documentId).emit('content_update', {
        content, title, version: state.version,
        userId: user._id.toString(), username: user.username
      });

      if (title !== undefined) {
        try {
          await Document.findByIdAndUpdate(documentId, { title });
          io.to(documentId).emit('title_updated', { title, username: user.username });

          await Document.findByIdAndUpdate(documentId, {
            $push: { activities: {
              userId: user._id, username: user.username,
              action: 'renamed', detail: `Renamed to "${title}"`,
              timestamp: new Date()
            }}
          });
        } catch (e) { console.error('Title update error:', e); }
      }

      if (content !== undefined) {
        scheduleSave(io, documentId, user._id, user.username);
      }
    });

    socket.on('cursor_move', ({ documentId, cursor }) => {
      const state = activeDocuments.get(documentId);
      if (!state) return;
      const userState = state.users.get(socket.id);
      if (userState) userState.cursor = cursor;
      socket.to(documentId).emit('cursor_update', {
        socketId: socket.id, userId: user._id.toString(),
        username: user.username, color: user.color, cursor
      });
    });

    socket.on('typing', ({ documentId, isTyping }) => {
      socket.to(documentId).emit('user_typing', {
        userId: user._id.toString(), username: user.username,
        color: user.color, isTyping
      });
    });

    socket.on('save_version', async ({ documentId, message }) => {
      const state = activeDocuments.get(documentId);
      if (!state) return;
      try {
        const doc = await Document.findById(documentId);
        if (!doc) return;

        const uid = user._id.toString();
        const ownerId = doc.owner?._id ? doc.owner._id.toString() : doc.owner.toString();
        const isOwner = ownerId === uid;
        const collab = doc.collaborators.find(c => {
          const cid = c.user?._id ? c.user._id.toString() : c.user.toString();
          return cid === uid;
        });
        if (!isOwner && !(collab && collab.role === 'editor')) return;

        const versionContent = state.content || doc.content || '';
        doc.content = versionContent;
        doc.versions.push({
          content: versionContent,
          savedBy: user._id,
          message: message || `Saved by ${user.username}`,
          charCount: versionContent.length
        });
        if (doc.versions.length > 50) doc.versions = doc.versions.slice(-50);

        doc.activities.push({
          userId: user._id, username: user.username,
          action: 'saved_version', detail: message || `Version saved by ${user.username}`
        });
        doc.lastEditedBy = user._id;
        await doc.save();

        io.to(documentId).emit('version_saved', {
          message: `📌 Version saved by ${user.username}`,
          savedBy: user.username, timestamp: new Date().toISOString()
        });
        io.to(documentId).emit('notification', {
          type: 'version_saved', message: `📌 Version saved by ${user.username}`
        });
      } catch (err) {
        console.error('Save version error:', err);
      }
    });

    socket.on('chat_message', async ({ documentId, message }) => {
      if (!message || message.trim().length === 0) return;
      const chatMsg = {
        id: Date.now().toString(),
        userId: user._id.toString(),
        username: user.username,
        color: user.color,
        message: message.trim().substring(0, 500),
        timestamp: new Date().toISOString()
      };

      // Broadcast to ALL users in room (including sender for confirmation)
      io.to(documentId).emit('chat_message', chatMsg);

      // Persist to DB
      try {
        await Document.findByIdAndUpdate(documentId, {
          $push: {
            chatMessages: {
              $each: [{
                userId: user._id, username: user.username,
                color: user.color, message: chatMsg.message,
                timestamp: new Date()
              }],
              $slice: -200
            }
          }
        });
      } catch (e) {
        console.error('Chat persist error:', e);
      }
    });

    socket.on('leave_document', ({ documentId }) => {
      handleLeaveDocument(socket, documentId, io);
    });

    socket.on('disconnect', async () => {
      console.log(`👤 ${user.username} disconnected`);
      if (socket.currentDocId) handleLeaveDocument(socket, socket.currentDocId, io);
    });
  });
}

async function handleLeaveDocument(socket, documentId, io) {
  const state = activeDocuments.get(documentId);
  if (!state) return;
  state.users.delete(socket.id);
  socket.leave(documentId);
  socket.to(documentId).emit('notification', {
    type: 'user_left', message: `${socket.user.username} left`
  });
  broadcastActiveUsers(io, documentId);
  if (state.users.size === 0) {
    if (state.content !== null) {
      try {
        await Document.findByIdAndUpdate(documentId, { content: state.content, updatedAt: new Date() });
      } catch (e) { console.error('Final save error:', e); }
    }
    activeDocuments.delete(documentId);
    if (saveTimers.has(documentId)) {
      clearTimeout(saveTimers.get(documentId));
      saveTimers.delete(documentId);
    }
  }
}

module.exports = { setupSocketHandlers };