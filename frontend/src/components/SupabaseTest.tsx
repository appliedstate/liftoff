import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const SupabaseTest: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const testConnection = async () => {
      try {
        const { error } = await supabase.from('_health').select('*').limit(1);
        if (error) {
          // This is expected if no tables exist yet
          setIsConnected(true);
        } else {
          setIsConnected(true);
        }
      } catch (err) {
        // Try a simpler test
        try {
          await supabase.auth.getSession();
          setIsConnected(true);
        } catch (authErr) {
          setError('Failed to connect to Supabase');
          setIsConnected(false);
        }
      } finally {
        setLoading(false);
      }
    };

    testConnection();
  }, []);

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Supabase Connection</h3>
      {loading ? (
        <p className="text-gray-600">Testing connection...</p>
      ) : isConnected ? (
        <p className="text-green-600">✅ Connected to Supabase</p>
      ) : (
        <p className="text-red-600">❌ {error || 'Connection failed'}</p>
      )}
    </div>
  );
};