// @ts-nocheck
import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';

// Import Catalyst components with proper types
import { Button, TouchTarget } from '../components/Catalyst/button';
import { Input, InputGroup } from '../components/Catalyst/input';
import { Badge } from '../components/Catalyst/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/Catalyst/card';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '../components/Catalyst/dialog';
import { Select } from '../components/Catalyst/select';
import { Checkbox, CheckboxField } from '../components/Catalyst/checkbox';
import { Textarea } from '../components/Catalyst/textarea';
import { Alert } from '../components/Catalyst/alert';
import { Avatar } from '../components/Catalyst/avatar';
import { Divider } from '../components/Catalyst/divider';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../components/Catalyst/table';

const meta = {
  title: 'Catalyst UI/Showcase',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Complete showcase of the Catalyst UI component library with proper TypeScript integration.'
      }
    }
  },
  tags: ['autodocs'],
} satisfies Meta<any>;

export default meta;
type Story = StoryObj<typeof meta>;

// Complete Catalyst Component Showcase
export const CompleteShowcase: Story = {
  render: () => (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Catalyst UI Components</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            A comprehensive component library built with Tailwind CSS and Headless UI.
            Featuring 20+ color variants, advanced accessibility, and modern design patterns.
          </p>
        </div>

        {/* Buttons Section */}
        <section className="bg-white rounded-xl p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Buttons</h2>

          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Color Variants</h3>
              <div className="flex flex-wrap gap-4">
                <Button color="dark/zinc">Zinc</Button>
                <Button color="blue">Blue</Button>
                <Button color="green">Green</Button>
                <Button color="red">Red</Button>
                <Button color="orange">Orange</Button>
                <Button color="purple">Purple</Button>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Button Styles</h3>
              <div className="flex flex-wrap gap-4">
                <Button>Solid</Button>
                <Button outline>Outline</Button>
                <Button plain>Plain</Button>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">With Icons</h3>
              <div className="flex flex-wrap gap-4">
                <Button>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h3a1 1 0 01.707 1.707l-4 4a1 1 0 01-1.414 0l-4-4A1 1 0 015 9h3V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Download
                </Button>
                <Button outline>
                  Settings
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Forms Section */}
        <section className="bg-white rounded-xl p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Form Components</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Input Fields</h3>
              <div className="space-y-4">
                <InputGroup>
                  <Input type="email" placeholder="Email address" />
                </InputGroup>

                <InputGroup>
                  <Input type="password" placeholder="Password" />
                </InputGroup>

                <InputGroup>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" data-slot="icon">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                  <Input type="search" placeholder="Search..." />
                </InputGroup>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Form Controls</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Select Option</label>
                  <Select placeholder="Select an option">
                    <option value="option1">Option 1</option>
                    <option value="option2">Option 2</option>
                    <option value="option3">Option 3</option>
                  </Select>
                </div>

                <div className="space-y-3">
                  <CheckboxField>
                    <Checkbox />
                    <span>Email notifications</span>
                  </CheckboxField>

                  <CheckboxField>
                    <Checkbox />
                    <span>SMS notifications</span>
                  </CheckboxField>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Message</label>
                  <Textarea rows={3} placeholder="Enter your message..." />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Cards Section */}
        <section className="bg-white rounded-xl p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Cards</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Project Alpha</CardTitle>
                <CardDescription>A revolutionary new application</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  This project showcases the latest in modern web development with cutting-edge features.
                </p>
              </CardContent>
              <CardFooter>
                <Button color="blue" className="w-full">View Project</Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Analytics Dashboard</CardTitle>
                <CardDescription>Real-time data visualization</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Users</span>
                    <span className="font-semibold">12,847</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Revenue</span>
                    <span className="font-semibold">$45,231</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <div className="flex gap-2">
                  <Button outline className="flex-1">Export</Button>
                  <Button color="green" className="flex-1">View Details</Button>
                </div>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Team Collaboration</CardTitle>
                <CardDescription>Connect and collaborate</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Avatar src="https://via.placeholder.com/32" alt="User" />
                  <Avatar src="https://via.placeholder.com/32" alt="User" />
                  <Avatar src="https://via.placeholder.com/32" alt="User" />
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium">
                    +5
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button color="purple" className="w-full">Join Team</Button>
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* Data Display */}
        <section className="bg-white rounded-xl p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Data Display</h2>

          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Badges</h3>
              <div className="flex flex-wrap gap-2">
                <Badge color="blue" className="">Primary</Badge>
                <Badge color="green" className="">Success</Badge>
                <Badge color="yellow" className="">Warning</Badge>
                <Badge color="red" className="">Error</Badge>
                <Badge color="gray" className="">Neutral</Badge>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Alerts</h3>
              <div className="space-y-4">
                <Alert>
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-800">
                        Successfully saved your changes!
                      </p>
                    </div>
                  </div>
                </Alert>

                <Alert>
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-yellow-800">
                        Please review your form before submitting.
                      </p>
                    </div>
                  </div>
                </Alert>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Table</h3>
              <Table>
                <TableHead>
                  <TableRow className="">
                    <TableHeader>Name</TableHeader>
                    <TableHeader>Email</TableHeader>
                    <TableHeader>Role</TableHeader>
                    <TableHeader>Status</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow className="">
                    <TableCell className="">John Doe</TableCell>
                    <TableCell className="">john@example.com</TableCell>
                    <TableCell className="">Admin</TableCell>
                    <TableCell className=""><Badge color="green" className="">Active</Badge></TableCell>
                  </TableRow>
                  <TableRow className="">
                    <TableCell className="">Jane Smith</TableCell>
                    <TableCell className="">jane@example.com</TableCell>
                    <TableCell className="">User</TableCell>
                    <TableCell className=""><Badge color="blue" className="">Pending</Badge></TableCell>
                  </TableRow>
                  <TableRow className="">
                    <TableCell className="">Bob Johnson</TableCell>
                    <TableCell className="">bob@example.com</TableCell>
                    <TableCell className="">Editor</TableCell>
                    <TableCell className=""><Badge color="yellow" className="">Inactive</Badge></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </section>

        {/* Dialog/Modal Demo */}
        <section className="bg-white rounded-xl p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Dialogs & Modals</h2>

          <div className="text-center">
            <Button color="blue" onClick={() => {
              const dialog = document.getElementById('demo-dialog');
              if (dialog) dialog.showModal();
            }}>
              Open Demo Dialog
            </Button>
          </div>

          <dialog id="demo-dialog" className="relative z-50">
            <DialogBody>
              <DialogTitle>Confirm Action</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this item? This action cannot be undone.
              </DialogDescription>
              <div className="mt-6 flex justify-end gap-3">
                <Button plain onClick={() => {
                  const dialog = document.getElementById('demo-dialog');
                  if (dialog) dialog.close();
                }}>
                  Cancel
                </Button>
                <Button color="red" onClick={() => {
                  const dialog = document.getElementById('demo-dialog');
                  if (dialog) dialog.close();
                }}>
                  Delete
                </Button>
              </div>
            </DialogBody>
          </dialog>
        </section>

        {/* Advanced Features */}
        <section className="bg-white rounded-xl p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Advanced Features</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Touch Targets</h3>
              <p className="text-sm text-gray-600 mb-4">
                All interactive elements have proper touch targets for mobile devices.
              </p>
              <Button color="green" className="w-full">
                <TouchTarget>Mobile-Friendly Button</TouchTarget>
              </Button>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Accessibility</h3>
              <p className="text-sm text-gray-600 mb-4">
                Built with Headless UI for comprehensive keyboard navigation and screen reader support.
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-sm">Screen reader compatible</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-sm">Keyboard navigation</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-sm">Focus management</span>
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* Usage Examples */}
        <section className="bg-gray-50 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Usage Examples</h2>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Basic Button</h3>
              <pre className="bg-gray-50 p-4 rounded text-sm overflow-x-auto">
{`import { Button } from '../components/Catalyst/button';

<Button color="blue">Click me</Button>`}
              </pre>
            </div>

            <div className="bg-white p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Form with Input Group</h3>
              <pre className="bg-gray-50 p-4 rounded text-sm overflow-x-auto">
{`import { Input, InputGroup } from '../components/Catalyst/input';

<InputGroup>
  <svg className="w-5 h-5" data-slot="icon">...</svg>
  <Input type="search" placeholder="Search..." />
</InputGroup>`}
              </pre>
            </div>

            <div className="bg-white p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Card with Components</h3>
              <pre className="bg-gray-50 p-4 rounded text-sm overflow-x-auto">
{`import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from '../components/Catalyst/card';

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter><Button>Action</Button></CardFooter>
</Card>`}
              </pre>
            </div>
          </div>
        </section>
      </div>
    </div>
  ),
};

// Individual Component Demos
export const ButtonVariants: Story = {
  render: () => (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold">Button Variants</h1>

      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Solid Colors</h2>
          <div className="flex flex-wrap gap-4">
            <Button color="blue">Blue</Button>
            <Button color="green">Green</Button>
            <Button color="red">Red</Button>
            <Button color="purple">Purple</Button>
            <Button color="orange">Orange</Button>
            <Button color="gray">Gray</Button>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Outline Style</h2>
          <div className="flex flex-wrap gap-4">
            <Button color="blue" outline>Blue</Button>
            <Button color="green" outline>Green</Button>
            <Button color="red" outline>Red</Button>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Plain Style</h2>
          <div className="flex flex-wrap gap-4">
            <Button color="blue" plain>Blue</Button>
            <Button color="green" plain>Green</Button>
            <Button color="red" plain>Red</Button>
          </div>
        </div>
      </div>
    </div>
  ),
};

export const FormComponents: Story = {
  render: () => (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold">Form Components</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Input Types</h2>

          <div className="space-y-4">
            <InputGroup>
              <Input type="text" placeholder="Text input" />
            </InputGroup>

            <InputGroup>
              <Input type="email" placeholder="Email address" />
            </InputGroup>

            <InputGroup>
              <Input type="password" placeholder="Password" />
            </InputGroup>

            <InputGroup>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" data-slot="icon">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
              <Input type="search" placeholder="Search..." />
            </InputGroup>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Form Controls</h2>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Select Option</label>
              <Select placeholder="Select an option">
                <option value="option1">Option 1</option>
                <option value="option2">Option 2</option>
                <option value="option3">Option 3</option>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Message</label>
              <Textarea rows={4} placeholder="Enter your message..." />
            </div>

            <div className="space-y-3">
              <CheckboxField>
                <Checkbox />
                <span>Agree to terms</span>
              </CheckboxField>

              <CheckboxField>
                <Checkbox />
                <span>Subscribe to newsletter</span>
              </CheckboxField>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
};

export const DataDisplay: Story = {
  render: () => (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold">Data Display Components</h1>

      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">Badges</h2>
          <div className="flex flex-wrap gap-3">
            <Badge color="blue" className="">Primary</Badge>
            <Badge color="green" className="">Success</Badge>
            <Badge color="yellow" className="">Warning</Badge>
            <Badge color="red" className="">Error</Badge>
            <Badge color="gray" className="">Neutral</Badge>
            <Badge color="purple" className="">Info</Badge>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Table</h2>
          <Table>
            <TableHead>
              <TableRow className="">
                <TableHeader>Name</TableHeader>
                <TableHeader>Role</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow className="">
                <TableCell className="">John Doe</TableCell>
                <TableCell className="">Developer</TableCell>
                <TableCell className=""><Badge color="green" className="">Active</Badge></TableCell>
                <TableCell className="">
                  <Button plain className="text-sm">Edit</Button>
                </TableCell>
              </TableRow>
              <TableRow className="">
                <TableCell className="">Jane Smith</TableCell>
                <TableCell className="">Designer</TableCell>
                <TableCell className=""><Badge color="yellow" className="">Pending</Badge></TableCell>
                <TableCell className="">
                  <Button plain className="text-sm">Edit</Button>
                </TableCell>
              </TableRow>
              <TableRow className="">
                <TableCell className="">Bob Johnson</TableCell>
                <TableCell className="">Manager</TableCell>
                <TableCell className=""><Badge color="red" className="">Inactive</Badge></TableCell>
                <TableCell className="">
                  <Button plain className="text-sm">Edit</Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  ),
};
