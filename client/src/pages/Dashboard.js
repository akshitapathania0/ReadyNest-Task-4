import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, API } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNotification } from '../contexts/NotificationContext';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const { notify } = useNotification();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await API.get('/documents');
      setDocuments(res.data.documents);
    } catch (err) {
      notify.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const createDocument = async () => {
    setCreating(true);
    try {
      const res = await API.post('/documents', { title: 'Untitled Document' });
      notify.success('Document created');
      navigate(`/doc/${res.data.document._id}`);
    } catch (err) {
      notify.error('Failed to create document');
      setCreating(false);
    }
  };

  const deleteDocument = async (docId) => {
    try {
      await API.delete(`/documents/${docId}`);
      setDocuments(prev => prev.filter(d => d._id !== docId));
      notify.success('Document deleted');
    } catch (err) {
      notify.error(err.response?.data?.error || 'Failed to delete');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const filteredDocs = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const myDocs = filteredDocs.filter(d => d.owner._id === user._id);
  const sharedDocs = filteredDocs.filter(d => d.owner._id !== user._id);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <div className="header-logo">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="url(#dg)"/>
              <path d="M8 10h10M8 16h16M8 22h12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="24" cy="10" r="3" fill="#34d399"/>
              <defs>
                <linearGradient id="dg" x1="0" y1="0" x2="32" y2="32">
                  <stop offset="0%" stopColor="#6366f1"/>
                  <stop offset="100%" stopColor="#8b5cf6"/>
                </linearGradient>
              </defs>
            </svg>
            <span className="header-brand">CollabSpace</span>
          </div>
        </div>

        <div className="header-center">
          <div className="search-bar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="header-right">
          <button className="icon-btn" onClick={toggleDarkMode} title="Toggle theme">
            {darkMode ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>

          <div className="profile-menu-wrapper">
            <button
              className="profile-btn"
              onClick={() => setShowProfileMenu(p => !p)}
              style={{ borderColor: user.color }}
            >
              <div className="avatar" style={{ background: user.color }}>
                {user.username[0].toUpperCase()}
              </div>
              <span className="profile-name">{user.username}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {showProfileMenu && (
              <div className="dropdown-menu" onClick={() => setShowProfileMenu(false)}>
                <div className="dropdown-user">
                  <div className="avatar lg" style={{ background: user.color }}>{user.username[0].toUpperCase()}</div>
                  <div>
                    <div className="dropdown-username">{user.username}</div>
                    <div className="dropdown-email">{user.email}</div>
                  </div>
                </div>
                <div className="dropdown-divider"/>
                <button className="dropdown-item danger" onClick={logout}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Hero create section */}
        <div className="create-section">
          <button className="create-card" onClick={createDocument} disabled={creating}>
            <div className="create-icon">
              {creating ? <span className="btn-spinner dark"/> : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              )}
            </div>
            <span>{creating ? 'Creating...' : 'New Document'}</span>
          </button>
        </div>

        {/* Documents */}
        {loading ? (
          <div className="docs-loading">
            {[1,2,3,4].map(i => <div key={i} className="doc-skeleton"/>)}
          </div>
        ) : (
          <>
            {myDocs.length > 0 && (
              <section className="docs-section">
                <h2 className="section-title">My Documents</h2>
                <div className="docs-grid">
                  {myDocs.map(doc => (
                    <DocCard
                      key={doc._id}
                      doc={doc}
                      isOwner={true}
                      onOpen={() => navigate(`/doc/${doc._id}`)}
                      onDelete={() => setDeleteConfirm(doc._id)}
                      formatDate={formatDate}
                      currentUserId={user._id}
                    />
                  ))}
                </div>
              </section>
            )}

            {sharedDocs.length > 0 && (
              <section className="docs-section">
                <h2 className="section-title">Shared with me</h2>
                <div className="docs-grid">
                  {sharedDocs.map(doc => (
                    <DocCard
                      key={doc._id}
                      doc={doc}
                      isOwner={false}
                      onOpen={() => navigate(`/doc/${doc._id}`)}
                      formatDate={formatDate}
                      currentUserId={user._id}
                    />
                  ))}
                </div>
              </section>
            )}

            {filteredDocs.length === 0 && (
              <div className="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <h3>{searchQuery ? 'No documents match your search' : 'No documents yet'}</h3>
                <p>{searchQuery ? 'Try a different search term' : 'Create your first document to get started'}</p>
                {!searchQuery && (
                  <button className="btn btn-primary" onClick={createDocument}>
                    Create document
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Delete document?</h3>
            <p>This action cannot be undone. The document and all its history will be permanently deleted.</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => deleteDocument(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DocCard({ doc, isOwner, onOpen, onDelete, formatDate }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="doc-card" onClick={onOpen}>
      <div className="doc-card-header">
        <div className="doc-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        </div>
        {isOwner && onDelete && (
          <div className="doc-menu-wrapper" onClick={e => e.stopPropagation()}>
            <button className="icon-btn sm" onClick={() => setMenuOpen(p => !p)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
              </svg>
            </button>
            {menuOpen && (
              <div className="dropdown-menu sm" onClick={() => setMenuOpen(false)}>
                <button className="dropdown-item danger" onClick={onDelete}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="doc-card-body">
        <h3 className="doc-title">{doc.title || 'Untitled Document'}</h3>
        <div className="doc-meta">
          <div className="doc-owner">
            <div className="avatar xs" style={{ background: doc.owner.color }}>
              {doc.owner.username[0].toUpperCase()}
            </div>
            <span>{doc.owner.username}</span>
          </div>
          <span className="doc-date">{formatDate(doc.updatedAt)}</span>
        </div>
      </div>

      <div className="doc-card-footer">
        {doc.collaborators?.length > 0 && (
          <div className="collab-avatars">
            {doc.collaborators.slice(0, 3).map((c, i) => (
              <div
                key={i}
                className="avatar xs stacked"
                style={{ background: c.user?.color, zIndex: 3 - i }}
                title={c.user?.username}
              >
                {c.user?.username?.[0]?.toUpperCase()}
              </div>
            ))}
            {doc.collaborators.length > 3 && (
              <span className="collab-more">+{doc.collaborators.length - 3}</span>
            )}
          </div>
        )}
        {doc.isPublic && (
          <span className="badge badge-public">Public</span>
        )}
      </div>
    </div>
  );
}
