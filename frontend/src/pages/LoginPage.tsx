import React from 'react';
import { AuthLayout } from '../components/Auth/AuthLayout';
import { LoginForm } from '../components/Auth/LoginForm';

export const LoginPage: React.FC = () => {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
};