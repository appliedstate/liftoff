import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';

interface ForgotPasswordFormProps {}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error } = await resetPassword(email);
    
    if (error) {
      setError(error.message);
    } else {
      setMessage('Check your email for the password reset link!');
    }
    
    setLoading(false);
  };

  return (
    <>
      <h2 className="mt-10 text-center text-2xl/9 font-bold tracking-tight text-white">Reset your password</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded text-sm">
            {error}
          </div>
        )}
        
        {message && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded text-sm">
            {message}
          </div>
        )}
        
        <div>
          <label htmlFor="email" className="block text-sm/6 font-medium text-gray-100">Email address</label>
          <div className="mt-2">
            <input
              id="email"
              type="email"
              name="email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="block w-full rounded-md bg-white/5 px-3 py-1.5 text-base text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full justify-center rounded-md bg-indigo-500 px-3 py-1.5 text-sm/6 font-semibold text-white hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Sending reset email...' : 'Send reset email'}
          </button>
        </div>
      </form>

      <p className="mt-10 text-center text-sm/6 text-gray-400">
        Remember your password?{' '}
        <Link to="/login" className="font-semibold text-indigo-400 hover:text-indigo-300">
          Sign in
        </Link>
      </p>
    </>
  );
};