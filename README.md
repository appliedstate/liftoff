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
   - Create `backend/.env` and set:
     - `PORT=3001`
     - `SEARCHAPI_API_KEY=<your key from SearchApi>`
     - (Optional) `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

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
- `SEARCHAPI_API_KEY` - API key for SearchApi (Meta Ad Library)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Your Supabase service role key

## API Endpoints

- `GET /` - Health check
- `GET /api/health` - API health status
- `GET /api/meta-ad-library/search` - Proxy to Meta Ad Library via SearchApi (query params: q, country, active_status, platforms, start_date, end_date)
- `POST /api/meta-ad-library/pages/analyze` - Analyze a list of Meta `pageIds` with optional filters; returns deduped ads and category counts

### Manual Page Analysis (CLI)

Prepare a file with page IDs (JSON array or newline list), then:

```bash
cd backend
npm run analyze:pages -- ./pages.json ./ads.csv US 2025-10-01 2025-10-20
```

Outputs a deduped CSV with ads across all pages.
