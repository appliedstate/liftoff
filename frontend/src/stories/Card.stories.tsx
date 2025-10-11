// @ts-nocheck
import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';

// Import actual Catalyst Card components
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/Catalyst/card';

const meta = {
  title: 'Design System/Card',
  component: Card,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Enhanced Card component with multiple variants, proper TypeScript support, and flexible layout components.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    children: {
      control: 'text',
      description: 'Card content'
    }
  },
  args: {
    children: 'Card content'
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

// Basic Card
export const Default: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>This is a default card with standard styling.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-gray-700">
          This is the main content area of the card. You can put any content here including text, images, buttons, or other components.
        </p>
      </CardContent>
      <CardFooter>
        <span className="text-sm text-gray-500">Footer content</span>
        <button className="text-primary-600 hover:text-primary-700 font-medium">
          Action
        </button>
      </CardFooter>
    </Card>
  ),
};

export const Elevated: Story = {
  render: () => (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Elevated Card</CardTitle>
        <CardDescription>This card has a more pronounced shadow for emphasis.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-gray-700">
          Elevated cards stand out more with their deeper shadows and are great for important content or CTAs.
        </p>
      </CardContent>
    </Card>
  ),
};

export const Outlined: Story = {
  render: () => (
    <Card className="border-2 border-gray-300">
      <CardHeader>
        <CardTitle>Outlined Card</CardTitle>
        <CardDescription>This card uses a thicker border instead of shadows.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-gray-700">
          Outlined cards work well when you want a clean, border-focused design without shadows.
        </p>
      </CardContent>
    </Card>
  ),
};

export const Filled: Story = {
  render: () => (
    <Card className="bg-gray-50">
      <CardHeader>
        <CardTitle>Filled Card</CardTitle>
        <CardDescription>This card has a subtle background color.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-gray-700">
          Filled cards provide a gentle background that helps separate content sections.
        </p>
      </CardContent>
    </Card>
  ),
};

export const Gradient: Story = {
  render: () => (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200">
      <CardHeader>
        <CardTitle>Gradient Card</CardTitle>
        <CardDescription>This card features a beautiful gradient background.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-gray-700">
          Gradient cards add visual interest and are perfect for featured content or premium sections.
        </p>
      </CardContent>
    </Card>
  ),
};

// Sizes
export const Small: Story = {
  render: () => (
    <Card className="p-4">
      <CardHeader>
        <CardTitle>Small Card</CardTitle>
        <CardDescription>Compact card with smaller padding.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-gray-700 text-sm">This card has reduced padding for more compact layouts.</p>
      </CardContent>
    </Card>
  ),
};

export const Medium: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Medium Card</CardTitle>
        <CardDescription>Standard card with balanced padding.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-gray-700">This is the default card size with comfortable padding around content.</p>
      </CardContent>
    </Card>
  ),
};

export const Large: Story = {
  render: () => (
    <Card className="p-8">
      <CardHeader>
        <CardTitle>Large Card</CardTitle>
        <CardDescription>Spacious card with generous padding.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-gray-700">This card provides ample space around content, perfect for detailed information or featured content.</p>
      </CardContent>
    </Card>
  ),
};

// Real-world Examples
export const ProductCard: Story = {
  render: () => (
    <Card className="max-w-sm shadow-lg">
      <div className="w-full h-48 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg mb-4 flex items-center justify-center">
        <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
        </svg>
      </div>
      <CardHeader>
        <CardTitle>Premium Plan</CardTitle>
        <CardDescription>Get unlimited access to all features</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center text-sm text-gray-600">
            <svg className="w-4 h-4 text-success-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Unlimited projects
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <svg className="w-4 h-4 text-success-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Advanced analytics
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <svg className="w-4 h-4 text-success-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Priority support
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex items-center">
          <span className="text-2xl font-bold text-gray-900">$29</span>
          <span className="text-gray-500 ml-1">/month</span>
        </div>
        <button className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">
          Get Started
        </button>
      </CardFooter>
    </Card>
  ),
};

export const UserProfileCard: Story = {
  render: () => (
    <Card className="max-w-md bg-gradient-to-br from-purple-50 to-pink-100 border border-purple-200">
      <div className="flex items-center space-x-4">
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="flex-1">
          <CardTitle className="text-white">John Doe</CardTitle>
          <CardDescription className="text-primary-100">
            Software Developer
          </CardDescription>
        </div>
      </div>
      <CardContent className="mt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">42</div>
            <div className="text-sm text-primary-100">Projects</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">1.2k</div>
            <div className="text-sm text-primary-100">Followers</div>
          </div>
        </div>
      </CardContent>
    </Card>
  ),
};

export const StatsCard: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl">
      <Card className="shadow-lg">
        <CardContent className="text-center">
          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
            </svg>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">2,543</div>
          <div className="text-gray-600">Total Users</div>
          <div className="flex items-center justify-center mt-2">
            <svg className="w-4 h-4 text-success-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-success-600 font-medium">+12.5%</span>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardContent className="text-center">
          <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-success-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">$48,392</div>
          <div className="text-gray-600">Revenue</div>
          <div className="flex items-center justify-center mt-2">
            <svg className="w-4 h-4 text-success-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-success-600 font-medium">+8.2%</span>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardContent className="text-center">
          <div className="w-12 h-12 bg-warning-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-warning-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">1,429</div>
          <div className="text-gray-600">Orders</div>
          <div className="flex items-center justify-center mt-2">
            <svg className="w-4 h-4 text-error-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L9 12.586V4a1 1 0 012 0v8.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-error-600 font-medium">-2.4%</span>
          </div>
        </CardContent>
      </Card>
    </div>
  ),
};

// All Variants Showcase
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h3 className="text-2xl font-semibold mb-6 text-gray-900">Card Variants</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Default</CardTitle>
              <CardDescription>Standard card with subtle shadow</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">This is the default card style with a clean, professional look.</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Elevated</CardTitle>
              <CardDescription>Card with prominent shadow</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">This card stands out with a stronger shadow effect.</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-gray-300">
            <CardHeader>
              <CardTitle>Outlined</CardTitle>
              <CardDescription>Card with thick border</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">This card uses a border instead of shadow for emphasis.</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-50">
            <CardHeader>
              <CardTitle>Filled</CardTitle>
              <CardDescription>Card with background color</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">This card has a subtle background to separate content.</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200">
            <CardHeader>
              <CardTitle className="text-white">Gradient</CardTitle>
              <CardDescription className="text-primary-100">Card with gradient background</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">This card features a beautiful gradient for visual appeal.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-semibold mb-6 text-gray-900">Card Sizes</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card size="small">
            <CardHeader>
              <CardTitle>Small Card</CardTitle>
              <CardDescription>Compact card with minimal padding</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 text-sm">This card has smaller padding for dense layouts.</p>
            </CardContent>
          </Card>

          <Card size="medium">
            <CardHeader>
              <CardTitle>Medium Card</CardTitle>
              <CardDescription>Standard card with balanced padding</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">This is the default card size with comfortable spacing.</p>
            </CardContent>
          </Card>

          <Card size="large">
            <CardHeader>
              <CardTitle>Large Card</CardTitle>
              <CardDescription>Spacious card with generous padding</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">This card provides ample space for detailed content.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story: 'Complete showcase of all card variants, sizes, and real-world examples.'
      }
    }
  }
};
