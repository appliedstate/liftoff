import React from 'react';

interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className = '' }) => {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center">
        <span className="text-white font-bold text-lg">L</span>
      </div>
    </div>
  );
};