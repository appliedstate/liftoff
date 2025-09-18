import React from 'react';

// Import the JSX Catalyst components
// @ts-ignore
import { Button as CatalystButton } from './Catalyst/button';
// @ts-ignore
import { Input as CatalystInput } from './Catalyst/input';
// @ts-ignore
import { Field as CatalystField } from './Catalyst/fieldset';
// @ts-ignore
import { Label as CatalystLabel } from './Catalyst/fieldset';
// @ts-ignore
import { Heading as CatalystHeading } from './Catalyst/heading';
// @ts-ignore
import { Text as CatalystText } from './Catalyst/text';
// @ts-ignore
import { Strong as CatalystStrong } from './Catalyst/text';
// @ts-ignore
import { TextLink as CatalystTextLink } from './Catalyst/text';

// TypeScript-compatible wrapper components
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  color?: string;
  outline?: boolean;
  plain?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, ...props }, ref) => {
    // @ts-ignore
    return <CatalystButton ref={ref} {...props}>{children}</CatalystButton>;
  }
);

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (props, ref) => {
    // @ts-ignore
    return <CatalystInput ref={ref} {...props} />;
  }
);

interface FieldProps {
  children: React.ReactNode;
  className?: string;
}

export const Field: React.FC<FieldProps> = ({ children, className = '' }) => {
  // @ts-ignore
  return <CatalystField className={className}>{children}</CatalystField>;
};

interface LabelProps {
  children: React.ReactNode;
  className?: string;
}

export const Label: React.FC<LabelProps> = ({ children, className = '' }) => {
  // @ts-ignore
  return <CatalystLabel className={className}>{children}</CatalystLabel>;
};

interface HeadingProps {
  children: React.ReactNode;
  className?: string;
  level?: number;
}

export const Heading: React.FC<HeadingProps> = ({ children, className = '', level }) => {
  // @ts-ignore
  return <CatalystHeading className={className} level={level}>{children}</CatalystHeading>;
};

interface TextProps {
  children: React.ReactNode;
  className?: string;
}

export const Text: React.FC<TextProps> = ({ children, className = '' }) => {
  // @ts-ignore
  return <CatalystText className={className}>{children}</CatalystText>;
};

interface StrongProps {
  children: React.ReactNode;
  className?: string;
}

export const Strong: React.FC<StrongProps> = ({ children, className = '' }) => {
  // @ts-ignore
  return <CatalystStrong className={className}>{children}</CatalystStrong>;
};

interface TextLinkProps {
  children: React.ReactNode;
  className?: string;
  as?: React.ComponentType<any>;
  to?: string;
  href?: string;
}

export const TextLink: React.FC<TextLinkProps> = ({ children, className = '', ...props }) => {
  // @ts-ignore
  return <CatalystTextLink className={className} {...props}>{children}</CatalystTextLink>;
};