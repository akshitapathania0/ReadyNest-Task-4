# CollabSpace — Real-Time Collaborative Platform

A full-stack real-time collaboration app built with React, Node.js, Socket.IO, and MongoDB. Multiple users can simultaneously edit documents, track changes, chat, and restore version history.

---

## Features

| Feature | Implementation |
|---|---|
| User Authentication | JWT-based login/register with bcrypt hashing |
| Real-time Collaboration | Socket.IO rooms with OT conflict handling |
| Multi-user Sync | Live content broadcast to all connected clients |
| Conflict Handling | Operational Transform (insert/delete transforms) |
| Activity Tracking | Active users panel, typing indicators, live cursors |
| Data Persistence | MongoDB with Mongoose; auto-save every 5s |
| Version History | Up to 50 named versions per document; restore any |
| Live Cursor Tracking | Cursor positions broadcast in real-time |
| Export | Export as .txt, .md, or .json |
| Web Notifications | Toast system for joins, saves, errors, messages |
| Dark Mode | Full dark/light theme with persistence |

---

## Tech Stack

- **Frontend:** React 18, React Router 6, Socket.IO Client, Axios
- **Backend:** Node.js, Express, Socket.IO, JWT, bcryptjs
- **Database:** MongoDB (via Mongoose)
- **Deploy:** Render (single service, Express serves React build)

---

## Project Structure

```
collabspace/
├── server/
│   ├── index.js             # Express + Socket.IO server
│   ├── models/
│   │   ├── User.js          # User schema
│   │   └── Document.js      # Document schema w/ versions + activity
│   ├── routes/
│   │   ├── auth.js          # Register, login, profile
│   │   └── documents.js     # CRUD, collaborators, versions, activity
│   ├── middleware/
│   │   └── auth.js          # JWT middleware (HTTP + Socket)
│   └── socket/
│       └── handlers.js      # All Socket.IO event handling + OT
├── client/
│   ├── public/index.html
│   └── src/
│       ├── App.js           # Routes + providers
│       ├── App.css          # Full design system
│       ├── contexts/
│       │   ├── AuthContext.js
│       │   ├── ThemeContext.js
│       │   └── NotificationContext.js
│       ├── hooks/
│       │   └── useSocket.js
│       ├── pages/
│       │   ├── Login.js
│       │   ├── Register.js
│       │   ├── Dashboard.js
│       │   └── Editor.js
│       └── components/
│           ├── ActiveUsers.js
│           ├── VersionHistory.js
│           ├── CollaboratorPanel.js
│           ├── ChatPanel.js
│           ├── ActivityLog.js
│           └── Notifications.js
├── render.yaml              # Render deploy config
└── package.json             # Root scripts
```
