// @ts-nocheck
import React from 'react';
import { Button, TouchTarget } from './Catalyst/button';
import { Input, InputGroup } from './Catalyst/input';
import { Badge } from './Catalyst/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Catalyst/card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from './Catalyst/table';

export function CatalystDemo() {
  return (
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
          </div>
        </section>

        {/* Form Components */}
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
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Badges</h3>
              <div className="flex flex-wrap gap-2">
                <Badge color="blue">Primary</Badge>
                <Badge color="green">Success</Badge>
                <Badge color="yellow">Warning</Badge>
                <Badge color="red">Error</Badge>
                <Badge color="gray">Neutral</Badge>
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
          </div>
        </section>

        {/* Table Section */}
        <section className="bg-white rounded-xl p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Data Table</h2>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Name</TableHeader>
                <TableHeader>Email</TableHeader>
                <TableHeader>Role</TableHeader>
                <TableHeader>Status</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>John Doe</TableCell>
                <TableCell>john@example.com</TableCell>
                <TableCell>Admin</TableCell>
                <TableCell><Badge color="green">Active</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Jane Smith</TableCell>
                <TableCell>jane@example.com</TableCell>
                <TableCell>User</TableCell>
                <TableCell><Badge color="blue">Pending</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Bob Johnson</TableCell>
                <TableCell>bob@example.com</TableCell>
                <TableCell>Editor</TableCell>
                <TableCell><Badge color="yellow">Inactive</Badge></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </section>

      </div>
    </div>
  );
}
