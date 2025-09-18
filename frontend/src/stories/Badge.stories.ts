import type { Meta, StoryObj } from '@storybook/react-webpack5';

// Import our Catalyst Badge components
import { Badge } from '../components/Catalyst/badge';
import { BadgeButton } from '../components/Catalyst/badge';

const meta = {
  title: 'Catalyst/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Badge components for displaying status, labels, and interactive elements with multiple color variants.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    color: {
      control: { type: 'select' },
      options: ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose', 'zinc'],
      description: 'Color variant for the badge'
    },
    children: {
      control: 'text',
      description: 'Badge content'
    }
  },
  args: {
    color: 'zinc',
    children: 'Badge'
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

// Color Variants
export const Red: Story = {
  args: {
    color: 'red',
    children: 'Error'
  },
};

export const Orange: Story = {
  args: {
    color: 'orange',
    children: 'Warning'
  },
};

export const Green: Story = {
  args: {
    color: 'green',
    children: 'Success'
  },
};

export const Blue: Story = {
  args: {
    color: 'blue',
    children: 'Info'
  },
};

export const Purple: Story = {
  args: {
    color: 'purple',
    children: 'Premium'
  },
};

// Status Examples
export const StatusBadges: Story = {
  render: () => (
    <div className="space-x-2">
      <Badge color="green">Active</Badge>
      <Badge color="yellow">Pending</Badge>
      <Badge color="red">Failed</Badge>
      <Badge color="blue">Processing</Badge>
    </div>
  ),
};

// Priority Levels
export const PriorityBadges: Story = {
  render: () => (
    <div className="space-x-2">
      <Badge color="red">High</Badge>
      <Badge color="orange">Medium</Badge>
      <Badge color="blue">Low</Badge>
      <Badge color="zinc">None</Badge>
    </div>
  ),
};

// Interactive Badge Buttons
export const BadgeButtons: Story = {
  render: () => (
    <div className="space-x-2">
      <BadgeButton color="blue" onClick={() => alert('Clicked!')}>
        Clickable Badge
      </BadgeButton>
      <BadgeButton color="green" href="#badge-link">
        Link Badge
      </BadgeButton>
      <BadgeButton color="red" disabled>
        Disabled Badge
      </BadgeButton>
    </div>
  ),
};

// With Icons
export const BadgesWithIcons: Story = {
  render: () => (
    <div className="space-x-2">
      <Badge color="green">
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Verified
      </Badge>
      <Badge color="red">
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        Error
      </Badge>
      <Badge color="blue">
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        Info
      </Badge>
    </div>
  ),
};

// All Colors Showcase
export const ColorShowcase: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4 max-w-md">
      <Badge color="red">Red</Badge>
      <Badge color="orange">Orange</Badge>
      <Badge color="amber">Amber</Badge>
      <Badge color="yellow">Yellow</Badge>
      <Badge color="lime">Lime</Badge>
      <Badge color="green">Green</Badge>
      <Badge color="emerald">Emerald</Badge>
      <Badge color="teal">Teal</Badge>
      <Badge color="cyan">Cyan</Badge>
      <Badge color="sky">Sky</Badge>
      <Badge color="blue">Blue</Badge>
      <Badge color="indigo">Indigo</Badge>
      <Badge color="violet">Violet</Badge>
      <Badge color="purple">Purple</Badge>
      <Badge color="fuchsia">Fuchsia</Badge>
      <Badge color="pink">Pink</Badge>
      <Badge color="rose">Rose</Badge>
      <Badge color="zinc">Zinc</Badge>
    </div>
  ),
  parameters: {
    layout: 'padded'
  }
};

// Real-world Examples
export const RealWorldExamples: Story = {
  render: () => (
    <div className="space-y-4 max-w-lg">
      <div className="space-y-2">
        <h4 className="text-sm font-medium">User Status</h4>
        <div className="space-x-2">
          <Badge color="green">Online</Badge>
          <Badge color="yellow">Away</Badge>
          <Badge color="zinc">Offline</Badge>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Task Priority</h4>
        <div className="space-x-2">
          <Badge color="red">Critical</Badge>
          <Badge color="orange">High</Badge>
          <Badge color="blue">Normal</Badge>
          <Badge color="zinc">Low</Badge>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">System Status</h4>
        <div className="space-x-2">
          <Badge color="green">Healthy</Badge>
          <Badge color="yellow">Warning</Badge>
          <Badge color="red">Critical</Badge>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Interactive Elements</h4>
        <div className="space-x-2">
          <BadgeButton color="blue" onClick={() => alert('Filter applied!')}>
            Filter
          </BadgeButton>
          <BadgeButton color="green" href="#settings">
            Settings
          </BadgeButton>
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded'
  }
};
