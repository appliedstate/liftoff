import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';

interface AuthenticatedRequest extends Request {
  user?: any;
}

export const authenticateUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Dev/admin token bypass for local tooling
    const adminHeader = (req.headers['x-admin-token'] as string) || (req.headers['x-strategist-token'] as string);
    const adminToken = process.env.STRATEGIST_ADMIN_TOKEN || process.env.STRATEGIST_DEV_ADMIN_TOKEN;
    if (adminHeader && adminToken && adminHeader === adminToken) {
      req.user = { id: 'dev-admin', role: 'admin', email: 'dev@local' };
      return next();
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header provided' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Dev/admin token bypass for local tooling
    const adminHeader = (req.headers['x-admin-token'] as string) || (req.headers['x-strategist-token'] as string);
    const adminToken = process.env.STRATEGIST_ADMIN_TOKEN || process.env.STRATEGIST_DEV_ADMIN_TOKEN;
    if (adminHeader && adminToken && adminHeader === adminToken) {
      req.user = { id: 'dev-admin', role: 'admin', email: 'dev@local' };
      return next();
    }

    const authHeader = req.headers.authorization;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      
      if (token) {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (!error && user) {
          req.user = user;
        }
      }
    }
    
    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next();
  }
};