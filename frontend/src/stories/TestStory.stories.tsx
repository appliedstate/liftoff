import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';

const meta = {
  title: 'Test/Test Story',
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<any>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HelloWorld: Story = {
  render: () => (
    <div className="p-8 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Hello World</h1>
      <p className="text-gray-600">This is a test story to verify Storybook is working.</p>
    </div>
  ),
};
