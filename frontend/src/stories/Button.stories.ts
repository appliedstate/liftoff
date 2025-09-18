import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { fn } from 'storybook/test';

// Import our Catalyst Button component
import { Button } from '../components/Catalyst/button';

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'Catalyst/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A comprehensive button component with multiple variants, colors, and states. Built with Tailwind CSS and Headless UI for accessibility and customization.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    color: {
      control: { type: 'select' },
      options: ['dark/zinc', 'dark/white', 'light', 'dark', 'zinc', 'indigo', 'cyan', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'sky', 'blue', 'violet', 'purple', 'fuchsia', 'pink', 'rose'],
      description: 'Color variant for the button'
    },
    outline: {
      control: 'boolean',
      description: 'Outline style button'
    },
    plain: {
      control: 'boolean',
      description: 'Plain text button style'
    },
    children: {
      control: 'text',
      description: 'Button content'
    }
  },
  args: {
    onClick: fn(),
    children: 'Click me'
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// Solid Buttons - Primary Actions
export const SolidDark: Story = {
  args: {
    color: 'dark/zinc',
    children: 'Solid Dark Button'
  },
};

export const SolidBlue: Story = {
  args: {
    color: 'blue',
    children: 'Solid Blue Button'
  },
};

export const SolidGreen: Story = {
  args: {
    color: 'green',
    children: 'Solid Green Button'
  },
};

export const SolidRed: Story = {
  args: {
    color: 'red',
    children: 'Solid Red Button'
  },
};

// Outline Buttons - Secondary Actions
export const Outline: Story = {
  args: {
    outline: true,
    children: 'Outline Button'
  },
};

// Plain Buttons - Tertiary Actions
export const Plain: Story = {
  args: {
    plain: true,
    children: 'Plain Button'
  },
};

// Button States
export const Disabled: Story = {
  args: {
    color: 'dark/zinc',
    children: 'Disabled Button',
    disabled: true
  },
};

// Button with Link
export const AsLink: Story = {
  args: {
    color: 'blue',
    children: 'Button as Link',
    href: '#'
  },
};

// Interactive States Showcase
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="space-x-4">
        <Button color="dark/zinc">Dark/Zinc</Button>
        <Button color="blue">Blue</Button>
        <Button color="green">Green</Button>
        <Button color="red">Red</Button>
      </div>

      <div className="space-x-4">
        <Button outline>Outline</Button>
        <Button plain>Plain</Button>
        <Button disabled>Disabled</Button>
      </div>

      <div className="space-x-4">
        <Button color="indigo">Indigo</Button>
        <Button color="violet">Violet</Button>
        <Button color="pink">Pink</Button>
        <Button color="orange">Orange</Button>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Showcase of all button variants and colors in the Catalyst design system.'
      }
    }
  }
};

// Documentation Story
export const Documentation: Story = {
  render: () => (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Catalyst Button Component</h2>
        <p className="text-gray-600 mb-4">
          The Catalyst Button component provides a comprehensive set of button styles with accessibility,
          hover states, and multiple color variants. Built with Tailwind CSS and Headless UI.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Features</h3>
        <ul className="list-disc list-inside space-y-1 text-gray-600">
          <li>Multiple color variants (20+ colors)</li>
          <li>Solid, outline, and plain styles</li>
          <li>Built-in focus management</li>
          <li>Disabled state support</li>
          <li>Link integration</li>
          <li>Icon support</li>
          <li>Dark mode support</li>
        </ul>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Usage</h3>
        <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
{`<Button color="blue">Primary Action</Button>
<Button outline>Secondary Action</Button>
<Button plain>Tertiary Action</Button>
<Button disabled>Disabled State</Button>`}
        </pre>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story: 'Complete documentation and usage examples for the Catalyst Button component.'
      }
    }
  }
};
