import React from 'react';
import { AuthLayout } from '../components/Auth/AuthLayout';
import { SignUpForm } from '../components/Auth/SignUpForm';

export const SignUpPage: React.FC = () => {
  return (
    <AuthLayout>
      <SignUpForm />
    </AuthLayout>
  );
};