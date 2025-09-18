import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export const UserProfile: React.FC = () => {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  if (!user) return null;

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Welcome!</h2>
        <button
          onClick={handleSignOut}
          className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors"
        >
          Sign Out
        </button>
      </div>
      
      <div className="space-y-2">
        <p className="text-sm text-gray-600">
          <span className="font-medium">Email:</span> {user.email}
        </p>
        <p className="text-sm text-gray-600">
          <span className="font-medium">User ID:</span> {user.id}
        </p>
        <p className="text-sm text-gray-600">
          <span className="font-medium">Confirmed:</span> {user.email_confirmed_at ? 'Yes' : 'No'}
        </p>
      </div>
    </div>
  );
};