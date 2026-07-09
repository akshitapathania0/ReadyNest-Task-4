import React, { useState } from 'react';
import { API } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

export default function CollaboratorPanel({ doc, onUpdate, currentUser }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [adding, setAdding] = useState(false);
  const [changingRole, setChangingRole] = useState(null);
  const { notify } = useNotification();

  const isOwner = doc?.owner?._id === currentUser._id ||
    doc?.owner?._id?.toString() === currentUser._id?.toString();

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    try {
      const res = await API.post(`/documents/${doc._id}/collaborators`, { email, role });
      onUpdate(res.data.document);
      setEmail('');
      notify.success('Collaborator added');
    } catch (err) {
      notify.error(err.response?.data?.error || 'Failed to add collaborator');
    } finally {
      setAdding(false);
    }
  };

  const handleRoleChange = async (userId, username, newRole) => {
    setChangingRole(userId);
    try {
      const res = await API.put(`/documents/${doc._id}/collaborators/${userId}/role`, { role: newRole });
      onUpdate(res.data.document);
      notify.success(`${username}'s role changed to ${newRole}`);
    } catch (err) {
      notify.error(err.response?.data?.error || 'Failed to change role');
    } finally {
      setChangingRole(null);
    }
  };

  const handleRemove = async (userId, username) => {
    if (!window.confirm(`Remove ${username} from this document?`)) return;
    try {
      await API.delete(`/documents/${doc._id}/collaborators/${userId}`);
      onUpdate(prev => ({
        ...prev,
        collaborators: prev.collaborators.filter(c => {
          const cid = c.user?._id?.toString() || c.user?.toString();
          return cid !== userId;
        })
      }));
      notify.success('Collaborator removed');
    } catch (err) {
      notify.error('Failed to remove collaborator');
    }
  };

  const handleVisibilityToggle = async () => {
    try {
      await API.put(`/documents/${doc._id}`, { isPublic: !doc.isPublic });
      onUpdate(prev => ({ ...prev, isPublic: !prev.isPublic }));
      notify.success(doc.isPublic ? 'Document is now private' : 'Document is now public');
    } catch {
      notify.error('Failed to update visibility');
    }
  };

  if (!doc) return null;

  return (
    <div className="collab-panel">
      {/* Owner */}
      <div className="collab-section">
        <div className="collab-section-title">Owner</div>
        <div className="collab-user">
          <div className="avatar sm" style={{ background: doc.owner?.color }}>
            {doc.owner?.username?.[0]?.toUpperCase()}
          </div>
          <div className="collab-user-info">
            <span className="collab-username">{doc.owner?.username}</span>
            <span className="collab-role owner">Owner</span>
          </div>
        </div>
      </div>

      {/* Collaborators */}
      {doc.collaborators?.length > 0 && (
        <div className="collab-section">
          <div className="collab-section-title">Collaborators ({doc.collaborators.length})</div>
          {doc.collaborators.map(c => {
            const userId = c.user?._id?.toString() || c.user?.toString();
            const username = c.user?.username || 'Unknown';
            const color = c.user?.color;
            return (
              <div key={userId} className="collab-user">
                <div className="avatar sm" style={{ background: color }}>
                  {username[0]?.toUpperCase()}
                </div>
                <div className="collab-user-info" style={{ flex: 1 }}>
                  <span className="collab-username">{username}</span>
                  {isOwner ? (
                    <select
                      className="role-select"
                      value={c.role}
                      disabled={changingRole === userId}
                      onChange={(e) => handleRoleChange(userId, username, e.target.value)}
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    <span className={`collab-role ${c.role}`}>{c.role}</span>
                  )}
                </div>
                {isOwner && (
                  <button
                    className="icon-btn sm danger"
                    onClick={() => handleRemove(userId, username)}
                    title="Remove"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Invite */}
      {isOwner && (
        <div className="collab-section">
          <div className="collab-section-title">Invite by email</div>
          <form onSubmit={handleAdd} className="add-collab-form">
            <input
              type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="colleague@example.com" required
            />
            <select value={role} onChange={e => setRole(e.target.value)}>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button type="submit" className="btn btn-primary btn-sm" disabled={adding}>
              {adding ? '…' : 'Invite'}
            </button>
          </form>
        </div>
      )}

      {/* Visibility */}
      {isOwner && (
        <div className="collab-section">
          <div className="collab-section-title">Visibility</div>
          <label className="toggle-row">
            <span>Public access</span>
            <div className={`toggle ${doc.isPublic ? 'on' : ''}`} onClick={handleVisibilityToggle} />
          </label>
          <p className="hint">
            {doc.isPublic ? 'Anyone with the link can view.' : 'Only invited collaborators can access.'}
          </p>
        </div>
      )}
    </div>
  );
}