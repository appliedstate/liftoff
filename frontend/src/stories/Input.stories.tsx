import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { fn } from 'storybook/test';

// Enhanced Input Component with proper TypeScript support
const EnhancedInput = ({
  label,
  error,
  helperText,
  className = '',
  ...props
}: any) => {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        className={`
          block w-full px-3 py-2 border rounded-lg shadow-sm
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
          disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
          ${error ? 'border-error-300 focus:ring-error-500 focus:border-error-500' : 'border-gray-300'}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="text-sm text-error-600">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
};

// Input Group Component
const InputGroup = ({ children, className = '', ...props }: any) => (
  <div className={`relative flex items-center ${className}`} {...props}>
    {children}
  </div>
);

const meta = {
  title: 'Design System/Input',
  component: EnhancedInput,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Enhanced Input components with proper TypeScript support, multiple variants, states, and accessibility features.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    label: {
      control: 'text',
      description: 'Input label'
    },
    type: {
      control: { type: 'select' },
      options: ['text', 'email', 'password', 'search', 'number', 'tel', 'url'],
      description: 'Input type'
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text'
    },
    disabled: {
      control: 'boolean',
      description: 'Disabled state'
    },
    error: {
      control: 'text',
      description: 'Error message'
    },
    helperText: {
      control: 'text',
      description: 'Helper text'
    }
  },
  args: {
    placeholder: 'Enter text...'
  },
} satisfies Meta<typeof EnhancedInput>;

export default meta;
type Story = StoryObj<typeof meta>;

// Basic Input Types
export const Text: Story = {
  args: {
    type: 'text',
    placeholder: 'Enter your name'
  },
};

export const Email: Story = {
  args: {
    type: 'email',
    placeholder: 'Enter your email'
  },
};

export const Password: Story = {
  args: {
    type: 'password',
    placeholder: 'Enter your password'
  },
};

export const Search: Story = {
  args: {
    type: 'search',
    placeholder: 'Search...'
  },
};

// Input States
export const Disabled: Story = {
  args: {
    disabled: true,
    placeholder: 'Disabled input',
    value: 'Cannot edit this'
  },
};

export const WithValue: Story = {
  args: {
    value: 'Pre-filled value',
    placeholder: 'This will be replaced'
  },
};

// Input with Labels and Validation
export const WithLabel: Story = {
  args: {
    label: 'Email Address',
    type: 'email',
    placeholder: 'Enter your email'
  },
};

export const WithError: Story = {
  args: {
    label: 'Email Address',
    type: 'email',
    placeholder: 'Enter your email',
    error: 'Please enter a valid email address'
  },
};

export const WithHelperText: Story = {
  args: {
    label: 'Password',
    type: 'password',
    placeholder: 'Enter your password',
    helperText: 'Must be at least 8 characters long'
  },
};

// Input with Icons
export const WithLeadingIcon: Story = {
  render: () => (
    <InputGroup>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
      </div>
      <EnhancedInput type="search" placeholder="Search..." className="pl-10" />
    </InputGroup>
  ),
};

export const WithTrailingIcon: Story = {
  render: () => (
    <InputGroup>
      <EnhancedInput type="email" placeholder="Email address" className="pr-10" />
      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
        <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
        </svg>
      </div>
    </InputGroup>
  ),
};

// Complete Form Example
export const CompleteForm: Story = {
  render: () => (
    <div className="max-w-md space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
        <div className="space-y-4">
          <EnhancedInput
            label="Full Name"
            type="text"
            placeholder="Enter your full name"
          />
          <EnhancedInput
            label="Email Address"
            type="email"
            placeholder="Enter your email"
            helperText="We'll never share your email with anyone else."
          />
          <EnhancedInput
            label="Password"
            type="password"
            placeholder="Create a password"
            helperText="Must be at least 8 characters long"
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Search</h3>
        <InputGroup>
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <EnhancedInput type="search" placeholder="Search for anything..." className="pl-10" />
        </InputGroup>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded'
  }
};

// All Input Variants Showcase
export const Showcase: Story = {
  render: () => (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h3 className="text-xl font-semibold mb-4 text-gray-900">Input Types</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EnhancedInput type="text" placeholder="Text input" />
          <EnhancedInput type="email" placeholder="Email input" />
          <EnhancedInput type="password" placeholder="Password input" />
          <EnhancedInput type="search" placeholder="Search input" />
          <EnhancedInput type="number" placeholder="Number input" />
          <EnhancedInput type="tel" placeholder="Phone input" />
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-4 text-gray-900">Input States</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <EnhancedInput placeholder="Normal state" />
          <EnhancedInput placeholder="Disabled state" disabled />
          <EnhancedInput placeholder="With value" value="Pre-filled content" />
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-4 text-gray-900">Validation States</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EnhancedInput
            label="Valid Input"
            placeholder="Valid input"
            helperText="This input is valid"
          />
          <EnhancedInput
            label="Invalid Input"
            placeholder="Invalid input"
            error="This field is required"
          />
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-4 text-gray-900">With Icons</h3>
        <div className="space-y-4">
          <InputGroup>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
            <EnhancedInput type="search" placeholder="Search..." className="pl-10" />
          </InputGroup>

          <InputGroup>
            <EnhancedInput type="email" placeholder="Email address" className="pr-10" />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
            </div>
          </InputGroup>
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story: 'Complete showcase of all input variants, states, and configurations.'
      }
    }
  }
};
