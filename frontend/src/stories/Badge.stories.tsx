// @ts-nocheck
import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';

// Enhanced Badge Components with proper TypeScript support
interface BadgeProps {
  variant?: 'default' | 'outline' | 'soft';
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'success' | 'warning' | 'error' | 'gray';
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}

const Badge = ({
  variant = 'default',
  size = 'medium',
  color = 'primary',
  children,
  className = '',
  ...props
}: BadgeProps) => {
  const baseClasses = 'inline-flex items-center font-medium rounded-full transition-colors duration-200';

  const variants = {
    default: '',
    outline: 'border-2',
    soft: 'bg-opacity-10 border border-opacity-20',
  };

  const sizes = {
    small: 'px-2.5 py-0.5 text-xs',
    medium: 'px-3 py-1 text-sm',
    large: 'px-4 py-1.5 text-base',
  };

  const colors = {
    primary: {
      default: 'bg-primary-600 text-white',
      outline: 'border-primary-600 text-primary-600 bg-transparent',
      soft: 'bg-primary-100 text-primary-800 border-primary-200',
    },
    success: {
      default: 'bg-success-600 text-white',
      outline: 'border-success-600 text-success-600 bg-transparent',
      soft: 'bg-success-100 text-success-800 border-success-200',
    },
    warning: {
      default: 'bg-warning-600 text-white',
      outline: 'border-warning-600 text-warning-600 bg-transparent',
      soft: 'bg-warning-100 text-warning-800 border-warning-200',
    },
    error: {
      default: 'bg-error-600 text-white',
      outline: 'border-error-600 text-error-600 bg-transparent',
      soft: 'bg-error-100 text-error-800 border-error-200',
    },
    gray: {
      default: 'bg-gray-600 text-white',
      outline: 'border-gray-600 text-gray-600 bg-transparent',
      soft: 'bg-gray-100 text-gray-800 border-gray-200',
    },
  };

  return (
    <span
      className={`${baseClasses} ${variants[variant as keyof typeof variants]} ${sizes[size as keyof typeof sizes]} ${colors[color as keyof typeof colors][variant as keyof typeof colors[keyof typeof colors]]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

interface BadgeButtonProps extends BadgeProps {
  onClick?: () => void;
  disabled?: boolean;
}

const BadgeButton = ({
  variant = 'default',
  size = 'medium',
  color = 'primary',
  children,
  className = '',
  ...props
}: BadgeButtonProps) => {
  const baseClasses = 'inline-flex items-center font-medium rounded-full transition-all duration-200 hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer';

  const variants = {
    default: '',
    outline: 'border-2',
    soft: 'bg-opacity-10 border border-opacity-20 hover:bg-opacity-20',
  };

  const sizes = {
    small: 'px-2.5 py-0.5 text-xs gap-1',
    medium: 'px-3 py-1 text-sm gap-1.5',
    large: 'px-4 py-1.5 text-base gap-2',
  };

  const colors = {
    primary: {
      default: 'bg-primary-600 text-white focus:ring-primary-500',
      outline: 'border-primary-600 text-primary-600 bg-transparent hover:bg-primary-50 focus:ring-primary-500',
      soft: 'bg-primary-100 text-primary-800 border-primary-200 hover:bg-primary-200 focus:ring-primary-500',
    },
    success: {
      default: 'bg-success-600 text-white focus:ring-success-500',
      outline: 'border-success-600 text-success-600 bg-transparent hover:bg-success-50 focus:ring-success-500',
      soft: 'bg-success-100 text-success-800 border-success-200 hover:bg-success-200 focus:ring-success-500',
    },
    warning: {
      default: 'bg-warning-600 text-white focus:ring-warning-500',
      outline: 'border-warning-600 text-warning-600 bg-transparent hover:bg-warning-50 focus:ring-warning-500',
      soft: 'bg-warning-100 text-warning-800 border-warning-200 hover:bg-warning-200 focus:ring-warning-500',
    },
    error: {
      default: 'bg-error-600 text-white focus:ring-error-500',
      outline: 'border-error-600 text-error-600 bg-transparent hover:bg-error-50 focus:ring-error-500',
      soft: 'bg-error-100 text-error-800 border-error-200 hover:bg-error-200 focus:ring-error-500',
    },
    gray: {
      default: 'bg-gray-600 text-white focus:ring-gray-500',
      outline: 'border-gray-600 text-gray-600 bg-transparent hover:bg-gray-50 focus:ring-gray-500',
      soft: 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200 focus:ring-gray-500',
    },
  };

  return (
    <button
      className={`${baseClasses} ${variants[variant as keyof typeof variants]} ${sizes[size as keyof typeof sizes]} ${colors[color as keyof typeof colors][variant as keyof typeof colors[keyof typeof colors]]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

const meta = {
  title: 'Design System/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Enhanced Badge components with multiple variants, colors, sizes, and interactive states. Built with proper TypeScript support and accessibility features.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'outline', 'soft'],
      description: 'Badge variant'
    },
    size: {
      control: { type: 'select' },
      options: ['small', 'medium', 'large'],
      description: 'Badge size'
    },
    color: {
      control: { type: 'select' },
      options: ['primary', 'success', 'warning', 'error', 'gray'],
      description: 'Badge color'
    },
    children: {
      control: 'text',
      description: 'Badge content'
    }
  },
  args: {
    children: 'Badge',
    variant: 'default',
    size: 'medium',
    color: 'primary'
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

// Basic Variants
export const Default: Story = {
  args: {
    variant: 'default',
    children: 'Default'
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline'
  },
};

export const Soft: Story = {
  args: {
    variant: 'soft',
    children: 'Soft'
  },
};

// Colors
export const Primary: Story = {
  args: {
    color: 'primary',
    children: 'Primary'
  },
};

export const Success: Story = {
  args: {
    color: 'success',
    children: 'Success'
  },
};

export const Warning: Story = {
  args: {
    color: 'warning',
    children: 'Warning'
  },
};

export const Error: Story = {
  args: {
    color: 'error',
    children: 'Error'
  },
};

export const Gray: Story = {
  args: {
    color: 'gray',
    children: 'Gray'
  },
};

// Sizes
export const Small: Story = {
  args: {
    size: 'small',
    children: 'Small'
  },
};

export const Medium: Story = {
  args: {
    size: 'medium',
    children: 'Medium'
  },
};

export const Large: Story = {
  args: {
    size: 'large',
    children: 'Large'
  },
};

// Status Examples
export const StatusBadges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge color="success">Active</Badge>
      <Badge color="warning">Pending</Badge>
      <Badge color="error">Failed</Badge>
      <Badge color="primary">Processing</Badge>
      <Badge color="gray">Inactive</Badge>
    </div>
  ),
};

// Priority Levels
export const PriorityBadges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge color="error" variant="soft">High</Badge>
      <Badge color="warning" variant="soft">Medium</Badge>
      <Badge color="primary" variant="soft">Normal</Badge>
      <Badge color="gray" variant="soft">Low</Badge>
    </div>
  ),
};

// Interactive Badge Buttons
export const BadgeButtons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <BadgeButton color="primary" onClick={() => alert('Filter applied!')}>
        Filter
      </BadgeButton>
      <BadgeButton color="success" variant="outline" onClick={() => alert('Tag clicked!')}>
        JavaScript
      </BadgeButton>
      <BadgeButton color="warning" variant="soft" onClick={() => alert('Category selected!')}>
        Featured
      </BadgeButton>
      <BadgeButton color="error" disabled>
        Disabled
      </BadgeButton>
    </div>
  ),
};

// With Icons
export const BadgesWithIcons: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Badge color="success">
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Verified
        </Badge>
        <Badge color="warning">
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Warning
        </Badge>
        <Badge color="error">
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Error
        </Badge>
        <Badge color="primary">
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          Info
        </Badge>
      </div>

      <div className="flex flex-wrap gap-3">
        <BadgeButton color="success" onClick={() => alert('Verified!')}>
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Verified
        </BadgeButton>
        <BadgeButton color="warning" variant="outline" onClick={() => alert('Notification!')}>
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Alert
        </BadgeButton>
      </div>
    </div>
  ),
};

// Color Showcase
export const ColorShowcase: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Solid Variants</h4>
        <div className="flex flex-wrap gap-2">
          <Badge color="primary">Primary</Badge>
          <Badge color="success">Success</Badge>
          <Badge color="warning">Warning</Badge>
          <Badge color="error">Error</Badge>
          <Badge color="gray">Gray</Badge>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Outline Variants</h4>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" color="primary">Primary</Badge>
          <Badge variant="outline" color="success">Success</Badge>
          <Badge variant="outline" color="warning">Warning</Badge>
          <Badge variant="outline" color="error">Error</Badge>
          <Badge variant="outline" color="gray">Gray</Badge>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Soft Variants</h4>
        <div className="flex flex-wrap gap-2">
          <Badge variant="soft" color="primary">Primary</Badge>
          <Badge variant="soft" color="success">Success</Badge>
          <Badge variant="soft" color="warning">Warning</Badge>
          <Badge variant="soft" color="error">Error</Badge>
          <Badge variant="soft" color="gray">Gray</Badge>
        </div>
      </div>
    </div>
  ),
};

// Real-world Examples
export const RealWorldExamples: Story = {
  render: () => (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h4 className="text-lg font-semibold mb-4">User Status</h4>
        <div className="flex flex-wrap gap-3">
          <Badge color="success">Online</Badge>
          <Badge color="warning">Away</Badge>
          <Badge color="gray">Offline</Badge>
          <Badge color="primary">In Meeting</Badge>
        </div>
      </div>

      <div>
        <h4 className="text-lg font-semibold mb-4">Task Priority</h4>
        <div className="flex flex-wrap gap-3">
          <Badge color="error" variant="soft">Critical</Badge>
          <Badge color="warning" variant="soft">High</Badge>
          <Badge color="primary" variant="soft">Normal</Badge>
          <Badge color="gray" variant="soft">Low</Badge>
        </div>
      </div>

      <div>
        <h4 className="text-lg font-semibold mb-4">System Status</h4>
        <div className="flex flex-wrap gap-3">
          <Badge color="success">Healthy</Badge>
          <Badge color="warning">Warning</Badge>
          <Badge color="error">Critical</Badge>
          <Badge color="gray">Maintenance</Badge>
        </div>
      </div>

      <div>
        <h4 className="text-lg font-semibold mb-4">Tags & Categories</h4>
        <div className="flex flex-wrap gap-3">
          <BadgeButton color="primary" variant="outline" onClick={() => alert('React clicked!')}>
            React
          </BadgeButton>
          <BadgeButton color="success" variant="soft" onClick={() => alert('TypeScript clicked!')}>
            TypeScript
          </BadgeButton>
          <BadgeButton color="warning" variant="outline" onClick={() => alert('JavaScript clicked!')}>
            JavaScript
          </BadgeButton>
          <BadgeButton color="error" variant="soft" onClick={() => alert('Python clicked!')}>
            Python
          </BadgeButton>
          <BadgeButton color="gray" variant="outline" onClick={() => alert('Design clicked!')}>
            Design
          </BadgeButton>
        </div>
      </div>

      <div>
        <h4 className="text-lg font-semibold mb-4">Product Features</h4>
        <div className="flex flex-wrap gap-3">
          <Badge color="success" size="small">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Included
          </Badge>
          <Badge color="primary" size="small">New</Badge>
          <Badge color="warning" size="small">Beta</Badge>
          <Badge color="error" size="small">Deprecated</Badge>
        </div>
      </div>
    </div>
  ),
};

// All Variants Showcase
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h3 className="text-2xl font-semibold mb-6 text-gray-900">Badge Variants</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h4 className="text-lg font-medium mb-3 text-gray-800">Solid</h4>
            <div className="flex flex-wrap gap-2">
              <Badge color="primary">Primary</Badge>
              <Badge color="success">Success</Badge>
              <Badge color="warning">Warning</Badge>
              <Badge color="error">Error</Badge>
              <Badge color="gray">Gray</Badge>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-medium mb-3 text-gray-800">Outline</h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" color="primary">Primary</Badge>
              <Badge variant="outline" color="success">Success</Badge>
              <Badge variant="outline" color="warning">Warning</Badge>
              <Badge variant="outline" color="error">Error</Badge>
              <Badge variant="outline" color="gray">Gray</Badge>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-medium mb-3 text-gray-800">Soft</h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant="soft" color="primary">Primary</Badge>
              <Badge variant="soft" color="success">Success</Badge>
              <Badge variant="soft" color="warning">Warning</Badge>
              <Badge variant="soft" color="error">Error</Badge>
              <Badge variant="soft" color="gray">Gray</Badge>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-semibold mb-6 text-gray-900">Badge Sizes</h3>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <Badge size="small" color="primary" className="mb-2">Small</Badge>
            <p className="text-sm text-gray-600">Small</p>
          </div>
          <div className="text-center">
            <Badge size="medium" color="primary" className="mb-2">Medium</Badge>
            <p className="text-sm text-gray-600">Medium</p>
          </div>
          <div className="text-center">
            <Badge size="large" color="primary" className="mb-2">Large</Badge>
            <p className="text-sm text-gray-600">Large</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-semibold mb-6 text-gray-900">Interactive Badges</h3>
        <div className="flex flex-wrap gap-4">
          <BadgeButton color="primary" onClick={() => alert('Primary clicked!')}>
            Primary
          </BadgeButton>
          <BadgeButton variant="outline" color="success" onClick={() => alert('Success clicked!')}>
            Success
          </BadgeButton>
          <BadgeButton variant="soft" color="warning" onClick={() => alert('Warning clicked!')}>
            Warning
          </BadgeButton>
          <BadgeButton color="error" disabled>
            Disabled
          </BadgeButton>
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-semibold mb-6 text-gray-900">Real-world Usage</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-gray-700">Status:</span>
            <Badge color="success">Active</Badge>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-700">Priority:</span>
            <Badge color="error" variant="soft">High</Badge>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-700">Tags:</span>
            <div className="flex gap-2">
              <BadgeButton variant="outline" color="primary">React</BadgeButton>
              <BadgeButton variant="soft" color="success">TypeScript</BadgeButton>
              <BadgeButton variant="outline" color="warning">Storybook</BadgeButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story: 'Complete showcase of all badge variants, sizes, colors, and interactive states.'
      }
    }
  }
};