import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';

// Enhanced Button Component with proper TypeScript support
interface EnhancedButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'warning';
  size?: 'small' | 'medium' | 'large' | 'xl';
  children?: React.ReactNode;
  className?: string;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  disabled?: boolean;
  [key: string]: any;
}

const EnhancedButton = ({
  variant = 'primary',
  size = 'medium',
  children,
  className = '',
  isLoading = false,
  leftIcon,
  rightIcon,
  ...props
}: EnhancedButtonProps) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed group';

  const variants: Record<string, string> = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 shadow-sm hover:shadow-md active:bg-primary-800',
    secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-primary-500 shadow-sm hover:shadow-md active:bg-gray-100',
    outline: 'bg-transparent text-primary-600 border border-primary-600 hover:bg-primary-50 focus:ring-primary-500 active:bg-primary-100',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus:ring-gray-500 active:bg-gray-200',
    danger: 'bg-error-600 text-white hover:bg-error-700 focus:ring-error-500 shadow-sm hover:shadow-md active:bg-error-800',
    success: 'bg-success-600 text-white hover:bg-success-700 focus:ring-success-500 shadow-sm hover:shadow-md active:bg-success-800',
    warning: 'bg-warning-600 text-white hover:bg-warning-700 focus:ring-warning-500 shadow-sm hover:shadow-md active:bg-warning-800',
  };

  const sizes: Record<string, string> = {
    small: 'px-3 py-1.5 text-sm gap-2',
    medium: 'px-4 py-2 text-base gap-2',
    large: 'px-6 py-3 text-lg gap-3',
    xl: 'px-8 py-4 text-xl gap-4',
  };

  const iconSizes: Record<string, string> = {
    small: 'w-4 h-4',
    medium: 'w-5 h-5',
    large: 'w-6 h-6',
    xl: 'w-7 h-7',
  };

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && (
        <svg className={`animate-spin ${iconSizes[size]}`} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {leftIcon && !isLoading && (
        <span className={`${iconSizes[size]} flex-shrink-0`}>
          {leftIcon}
        </span>
      )}
      <span className={isLoading ? 'opacity-75' : ''}>
        {children}
      </span>
      {rightIcon && !isLoading && (
        <span className={`${iconSizes[size]} flex-shrink-0`}>
          {rightIcon}
        </span>
      )}
    </button>
  );
};

const meta = {
  title: 'Design System/Button',
  component: EnhancedButton,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Enhanced Button component with multiple variants, sizes, loading states, and icons. Built with proper TypeScript support and accessibility features.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'outline', 'ghost', 'danger', 'success', 'warning'],
      description: 'Button variant'
    },
    size: {
      control: { type: 'select' },
      options: ['small', 'medium', 'large', 'xl'],
      description: 'Button size'
    },
    children: {
      control: 'text',
      description: 'Button content'
    },
    isLoading: {
      control: 'boolean',
      description: 'Loading state'
    },
    disabled: {
      control: 'boolean',
      description: 'Disabled state'
    },
    onClick: {
      action: 'clicked',
      description: 'Click handler'
    }
  },
  args: {
    children: 'Click me',
    variant: 'primary',
    size: 'medium'
  },
} satisfies Meta<typeof EnhancedButton>;

export default meta;
type Story = StoryObj<typeof meta>;

// Primary Variants
export const Primary: Story = {
  args: {
    children: 'Primary Button',
    variant: 'primary'
  },
};

export const Secondary: Story = {
  args: {
    children: 'Secondary Button',
    variant: 'secondary'
  },
};

export const Outline: Story = {
  args: {
    children: 'Outline Button',
    variant: 'outline'
  },
};

export const Ghost: Story = {
  args: {
    children: 'Ghost Button',
    variant: 'ghost'
  },
};

// Status Variants
export const Danger: Story = {
  args: {
    children: 'Delete Item',
    variant: 'danger'
  },
};

export const Success: Story = {
  args: {
    children: 'Save Changes',
    variant: 'success'
  },
};

export const Warning: Story = {
  args: {
    children: 'Proceed with Caution',
    variant: 'warning'
  },
};

// Sizes
export const Small: Story = {
  args: {
    children: 'Small Button',
    size: 'small'
  },
};

export const Medium: Story = {
  args: {
    children: 'Medium Button',
    size: 'medium'
  },
};

export const Large: Story = {
  args: {
    children: 'Large Button',
    size: 'large'
  },
};

export const ExtraLarge: Story = {
  args: {
    children: 'Extra Large Button',
    size: 'xl'
  },
};

// States
export const Disabled: Story = {
  args: {
    children: 'Disabled Button',
    disabled: true
  },
};

export const Loading: Story = {
  args: {
    children: 'Loading...',
    isLoading: true
  },
};

// With Icons
export const WithLeftIcon: Story = {
  args: {
    children: 'Download',
    leftIcon: (
      <svg fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586 11.293 8.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 011.414-1.414z" clipRule="evenodd" />
      </svg>
    )
  },
};

export const WithRightIcon: Story = {
  args: {
    children: 'Next',
    rightIcon: (
      <svg fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    )
  },
};

// Showcase
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h3 className="text-xl font-semibold mb-4 text-gray-900">Button Variants</h3>
        <div className="flex flex-wrap gap-4">
          <EnhancedButton variant="primary">Primary</EnhancedButton>
          <EnhancedButton variant="secondary">Secondary</EnhancedButton>
          <EnhancedButton variant="outline">Outline</EnhancedButton>
          <EnhancedButton variant="ghost">Ghost</EnhancedButton>
          <EnhancedButton variant="danger">Danger</EnhancedButton>
          <EnhancedButton variant="success">Success</EnhancedButton>
          <EnhancedButton variant="warning">Warning</EnhancedButton>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-4 text-gray-900">Button Sizes</h3>
        <div className="flex flex-wrap items-center gap-4">
          <EnhancedButton size="small">Small</EnhancedButton>
          <EnhancedButton size="medium">Medium</EnhancedButton>
          <EnhancedButton size="large">Large</EnhancedButton>
          <EnhancedButton size="xl">Extra Large</EnhancedButton>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-4 text-gray-900">Button States</h3>
        <div className="flex flex-wrap gap-4">
          <EnhancedButton disabled>Disabled</EnhancedButton>
          <EnhancedButton isLoading>Loading</EnhancedButton>
          <EnhancedButton isLoading variant="secondary">Loading Secondary</EnhancedButton>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-4 text-gray-900">Buttons with Icons</h3>
        <div className="flex flex-wrap gap-4">
          <EnhancedButton
            leftIcon={
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586 11.293 8.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 011.414-1.414z" clipRule="evenodd" />
              </svg>
            }
          >
            Download
          </EnhancedButton>
          <EnhancedButton
            rightIcon={
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            }
          >
            Next Step
          </EnhancedButton>
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story: 'Complete showcase of all button variants, sizes, states, and configurations.'
      }
    }
  }
};
