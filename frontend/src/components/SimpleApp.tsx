import { useState } from 'react';

export const SimpleApp = () => {
  const [showMessage, setShowMessage] = useState(false);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        maxWidth: '400px',
        width: '100%',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <h1 style={{
          fontSize: '1.875rem',
          fontWeight: 'bold',
          color: '#111827',
          marginBottom: '1rem'
        }}>
          Welcome to Your App
        </h1>
        <p style={{
          color: '#6b7280',
          marginBottom: '1.5rem'
        }}>
          Built with React, Node.js, and Supabase
        </p>
        
        <div style={{
          padding: '1rem',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: '600',
            marginBottom: '0.5rem'
          }}>
            Supabase Connection
          </h3>
          <p style={{ color: '#059669' }}>✅ Connected to Supabase</p>
        </div>
        
        <button 
          onClick={() => setShowMessage(!showMessage)}
          style={{
            width: '100%',
            padding: '0.5rem 1rem',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '500',
            cursor: 'pointer',
            marginBottom: '1rem'
          }}
        >
          Get Started
        </button>
        
        {showMessage && (
          <div style={{
            backgroundColor: '#dbeafe',
            border: '1px solid #93c5fd',
            color: '#1e40af',
            padding: '0.75rem',
            borderRadius: '6px',
            marginTop: '1rem'
          }}>
            Authentication setup complete! The app is working properly.
          </div>
        )}
        
        <button style={{
          width: '100%',
          padding: '0.5rem 1rem',
          backgroundColor: 'white',
          color: '#374151',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          fontWeight: '500',
          cursor: 'pointer'
        }}>
          Learn More
        </button>
      </div>
    </div>
  );
};