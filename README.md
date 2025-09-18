# Web App Project

A full-stack web application built with React, Node.js, and Supabase.

## Tech Stack

- **Frontend**: React with TypeScript
- **Backend**: Node.js with Express
- **Database**: Supabase (PostgreSQL)

## Project Structure

```
/
├── frontend/          # React application
├── backend/           # Node.js API server
└── README.md         # This file
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Supabase account

### Setup

1. Clone the repository
2. Set up environment variables:
   - Copy `frontend/.env.example` to `frontend/.env` and fill in your Supabase credentials
   - Copy `backend/.env.example` to `backend/.env` and fill in your Supabase credentials

### Frontend

```bash
cd frontend
npm install
npm start
```

The frontend will run on http://localhost:3000

### Backend

```bash
cd backend
npm install
npm run dev
```

The backend will run on http://localhost:3001

## Environment Variables

### Frontend (.env)
- `REACT_APP_SUPABASE_URL` - Your Supabase project URL
- `REACT_APP_SUPABASE_ANON_KEY` - Your Supabase anon key

### Backend (.env)
- `PORT` - Server port (default: 3001)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Your Supabase service role key

## API Endpoints

- `GET /` - Health check
- `GET /api/health` - API health status# Test change
