import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Backend server is running!' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Protected route example
import { authenticateUser } from './middleware/auth';

app.get('/api/profile', authenticateUser, (req: any, res) => {
  res.json({ 
    message: 'Protected route accessed successfully',
    user: req.user 
  });
});

// Public route that optionally includes user data
import { optionalAuth } from './middleware/auth';

app.get('/api/public', optionalAuth, (req: any, res) => {
  res.json({ 
    message: 'Public route',
    user: req.user || null,
    timestamp: new Date().toISOString()
  });
});

// Meta Ad Library route
import metaAdLibraryRouter from './routes/metaAdLibrary';
app.use('/api/meta-ad-library', metaAdLibraryRouter);

// Strategist router
import strategistRouter from './routes/strategist';
app.use('/api/strategist', strategistRouter);

// Terminal router
import terminalRouter from './routes/terminal';
app.use('/api/terminal', terminalRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});