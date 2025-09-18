import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { fn } from 'storybook/test';

// Import our Catalyst Input components
import { Input } from '../components/Catalyst/input';
import { InputGroup } from '../components/Catalyst/input';

const meta = {
  title: 'Catalyst/Input',
  component: Input,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A comprehensive input component with validation states, icons, and accessibility features.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: { type: 'select' },
      options: ['text', 'email', 'password', 'number', 'tel', 'url', 'search'],
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
    required: {
      control: 'boolean',
      description: 'Required field'
    }
  },
  args: {
    placeholder: 'Enter text...',
    type: 'text'
  },
} satisfies Meta<typeof Input>;

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

// Input with Icons
export const WithLeadingIcon: Story = {
  render: () => (
    <InputGroup>
      <span data-slot="icon" className="text-gray-500">🔍</span>
      <Input type="search" placeholder="Search with icon..." />
    </InputGroup>
  ),
};

export const WithTrailingIcon: Story = {
  render: () => (
    <InputGroup>
      <Input type="email" placeholder="Email address" />
      <span data-slot="icon" className="text-gray-500">📧</span>
    </InputGroup>
  ),
};

// Form Field Showcase
export const FormField: Story = {
  render: () => {
    const Field = require('../components/Catalyst/fieldset').Field;
    const Label = require('../components/Catalyst/fieldset').Label;
    const Description = require('../components/Catalyst/fieldset').Description;

    return (
      <Field className="max-w-sm">
        <Label>Email Address</Label>
        <Description>We'll never share your email with anyone else.</Description>
        <Input type="email" placeholder="Enter your email" />
      </Field>
    );
  },
};

// All Input Variants
export const Showcase: Story = {
  render: () => (
    <div className="space-y-6 max-w-md">
      <div>
        <h3 className="text-lg font-semibold mb-3">Input Types</h3>
        <div className="space-y-3">
          <Input type="text" placeholder="Text input" />
          <Input type="email" placeholder="Email input" />
          <Input type="password" placeholder="Password input" />
          <Input type="search" placeholder="Search input" />
          <Input type="number" placeholder="Number input" />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Input States</h3>
        <div className="space-y-3">
          <Input placeholder="Normal state" />
          <Input placeholder="Disabled state" disabled />
          <Input placeholder="With value" value="Pre-filled content" />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">With Icons</h3>
        <div className="space-y-3">
          <InputGroup>
            <span data-slot="icon" className="text-gray-500">🔍</span>
            <Input type="search" placeholder="Search..." />
          </InputGroup>

          <InputGroup>
            <Input type="email" placeholder="Email..." />
            <span data-slot="icon" className="text-gray-500">📧</span>
          </InputGroup>
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded'
  }
};
