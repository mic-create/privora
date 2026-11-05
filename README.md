# PRIVORA — Secure P2P File Sharing & Messaging

PRIVORA is a privacy-first, end-to-end encrypted peer-to-peer file-sharing and real-time messaging application.

## Project Architecture

- **Frontend (`/frontend`)**: Vanilla JavaScript, Tailwind CSS, WebRTC API, Web Crypto API. Hosted on Vercel.
- **Backend (`/backend`)**: Node.js, Express.js, WebSocket signaling server. Hosted on Render.

## Local Development

1. Install backend dependencies:
   ```bash
   cd backend
   npm install