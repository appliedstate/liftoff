import React from 'react';

// Enhanced Card Components with proper TypeScript support
export const Card = ({
  variant = 'default',
  size = 'medium',
  children,
  className = '',
  ...props
}) => {
  const baseClasses = 'rounded-xl bg-white transition-all duration-200';

  const variants = {
    default: 'border border-gray-200 shadow-soft hover:shadow-medium',
    elevated: 'shadow-medium hover:shadow-large',
    outlined: 'border-2 border-gray-200 hover:border-primary-300',
    filled: 'bg-gray-50 border border-gray-200 hover:bg-gray-100',
    gradient: 'bg-gradient-to-br from-primary-50 to-primary-100 border border-primary-200 shadow-soft',
  };

  const sizes = {
    small: 'p-4',
    medium: 'p-6',
    large: 'p-8',
  };

  return (
    <div className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '', ...props }) => (
  <div className={`mb-4 ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ children, className = '', ...props }) => (
  <h3 className={`text-xl font-semibold text-gray-900 ${className}`} {...props}>
    {children}
  </h3>
);

export const CardDescription = ({ children, className = '', ...props }) => (
  <p className={`text-gray-600 mt-1 ${className}`} {...props}>
    {children}
  </p>
);

export const CardContent = ({ children, className = '', ...props }) => (
  <div className={`${className}`} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ children, className = '', ...props }) => (
  <div className={`mt-6 pt-4 border-t border-gray-200 flex items-center justify-between ${className}`} {...props}>
    {children}
  </div>
);
