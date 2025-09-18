import React from 'react';
import { AuthLayout } from '../components/Auth/AuthLayout';
import { ForgotPasswordForm } from '../components/Auth/ForgotPasswordForm';

export const ForgotPasswordPage: React.FC = () => {
  return (
    <AuthLayout>
      <ForgotPasswordForm />
    </AuthLayout>
  );
};