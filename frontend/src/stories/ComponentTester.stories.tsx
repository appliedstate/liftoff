import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';

// Linear-inspired Component Testing Framework
interface ComponentTesterProps {
  children?: React.ReactNode;
  testMode?: 'environment' | 'appearance' | 'hierarchy' | 'accessibility';
  className?: string;
  [key: string]: any;
}

const ComponentTester = ({
  children,
  testMode = 'environment',
  className = '',
  ...props
}: ComponentTesterProps) => {
  const testEnvironments: Record<string, { className: string }> = {
    environment: {
      // Test different viewports and platforms
      className: 'max-w-screen-xl mx-auto p-4 bg-gray-50 min-h-screen'
    },
    appearance: {
      // Test different themes and contrast levels
      className: 'space-y-8 p-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen'
    },
    hierarchy: {
      // Test component combinations and spacing
      className: 'space-y-6 p-8 bg-white min-h-screen'
    },
    accessibility: {
      // Test accessibility features
      className: 'p-6 bg-black text-white min-h-screen'
    }
  };

  return (
    <div className={`${testEnvironments[testMode].className} ${className}`} {...props}>
      {children}
    </div>
  );
};

// Test Environment Component
interface EnvironmentTestProps {
  children?: React.ReactNode;
  platform?: 'desktop' | 'tablet' | 'mobile';
}

const EnvironmentTest = ({ children, platform = 'desktop' }: EnvironmentTestProps) => {
  const platforms: Record<string, string> = {
    desktop: 'max-w-screen-xl',
    tablet: 'max-w-4xl',
    mobile: 'max-w-sm'
  };

  return (
    <div className={`${platforms[platform]} mx-auto border rounded-lg p-4 bg-white shadow-soft`}>
      <div className="mb-4 pb-2 border-b border-gray-200">
        <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
          {platform} Environment
        </h4>
      </div>
      {children}
    </div>
  );
};

// Test Theme Component
interface ThemeTestProps {
  children?: React.ReactNode;
  theme?: 'light' | 'dark' | 'highContrast' | 'lowContrast';
  contrast?: 'normal' | 'high' | 'low';
}

const ThemeTest = ({ children, theme = 'light', contrast = 'normal' }: ThemeTestProps) => {
  const themes: Record<string, string> = {
    light: 'bg-white text-gray-900',
    dark: 'bg-gray-900 text-white',
    highContrast: 'bg-black text-white',
    lowContrast: 'bg-gray-100 text-gray-600'
  };

  const contrasts: Record<string, string> = {
    normal: '',
    high: 'contrast-125',
    low: 'contrast-75'
  };

  return (
    <div className={`p-6 rounded-lg border shadow-soft ${themes[theme]} ${contrasts[contrast]}`}>
      <div className="mb-4 pb-2 border-b border-current opacity-20">
        <h4 className="text-sm font-semibold uppercase tracking-wider opacity-75">
          {theme} Theme ({contrast} contrast)
        </h4>
      </div>
      {children}
    </div>
  );
};

// Test Hierarchy Component
interface HierarchyTestProps {
  children?: React.ReactNode;
  level?: 'page' | 'section' | 'component' | 'element';
}

const HierarchyTest = ({ children, level = 'page' }: HierarchyTestProps) => {
  const levels: Record<string, string> = {
    page: 'space-y-8 p-8',
    section: 'space-y-6 p-6',
    component: 'space-y-4 p-4',
    element: 'space-y-2 p-2'
  };

  return (
    <div className={`border rounded-lg bg-white shadow-soft ${levels[level]}`}>
      <div className="mb-4 pb-2 border-b border-gray-200">
        <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
          {level} Level Hierarchy
        </h4>
      </div>
      {children}
    </div>
  );
};

const meta = {
  title: 'Design System/Component Testing',
  component: ComponentTester,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Linear-inspired component testing framework for stress testing components across different environments, themes, and hierarchies.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    testMode: {
      control: { type: 'select' },
      options: ['environment', 'appearance', 'hierarchy', 'accessibility'],
      description: 'Testing mode inspired by Linear\'s stress testing approach'
    }
  },
  args: {
    testMode: 'environment'
  },
} satisfies Meta<typeof ComponentTester>;

export default meta;
type Story = StoryObj<typeof meta>;

// Linear-inspired Environment Testing
export const EnvironmentTesting: Story = {
  args: {
    testMode: 'environment'
  },
  render: () => (
    <ComponentTester testMode="environment">
      <div className="space-y-8">
        <div>
          <h2 className="text-display-sm mb-6 text-gray-900">Cross-Platform Environment Testing</h2>
          <p className="text-body-md text-gray-600 mb-8">
            Testing components across different viewport sizes and platforms, inspired by Linear's environment testing approach.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <EnvironmentTest platform="desktop">
            <div className="space-y-4">
              <button className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">
                Desktop Button
              </button>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Desktop input field"
              />
              <div className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <label className="text-sm">Desktop checkbox</label>
              </div>
            </div>
          </EnvironmentTest>

          <EnvironmentTest platform="tablet">
            <div className="space-y-4">
              <button className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">
                Tablet Button
              </button>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Tablet input field"
              />
              <div className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <label className="text-sm">Tablet checkbox</label>
              </div>
            </div>
          </EnvironmentTest>

          <EnvironmentTest platform="mobile">
            <div className="space-y-4">
              <button className="bg-primary-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-primary-700 transition-colors">
                Mobile Button
              </button>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Mobile input"
              />
              <div className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <label className="text-xs">Mobile checkbox</label>
              </div>
            </div>
          </EnvironmentTest>
        </div>
      </div>
    </ComponentTester>
  ),
};

// Linear-inspired Appearance Testing
export const AppearanceTesting: Story = {
  args: {
    testMode: 'appearance'
  },
  render: () => (
    <ComponentTester testMode="appearance">
      <div className="space-y-8">
        <div>
          <h2 className="text-display-sm mb-6 text-gray-900">Theme & Appearance Testing</h2>
          <p className="text-body-md text-gray-600 mb-8">
            Testing components across different themes and contrast levels, following Linear's appearance testing methodology.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ThemeTest theme="light" contrast="normal">
            <div className="space-y-4">
              <h5 className="text-heading-sm">Light Theme</h5>
              <button className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700">
                Primary Button
              </button>
              <p className="text-body-sm">This is regular body text in light theme.</p>
              <div className="bg-gray-100 p-2 rounded">
                <code className="text-xs">const code = "example";</code>
              </div>
            </div>
          </ThemeTest>

          <ThemeTest theme="dark" contrast="normal">
            <div className="space-y-4">
              <h5 className="text-heading-sm">Dark Theme</h5>
              <button className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700">
                Primary Button
              </button>
              <p className="text-body-sm">This is regular body text in dark theme.</p>
              <div className="bg-gray-800 p-2 rounded">
                <code className="text-xs">const code = "example";</code>
              </div>
            </div>
          </ThemeTest>

          <ThemeTest theme="highContrast" contrast="high">
            <div className="space-y-4">
              <h5 className="text-heading-sm">High Contrast</h5>
              <button className="bg-yellow-400 text-black px-4 py-2 rounded-lg hover:bg-yellow-500 font-semibold">
                Primary Button
              </button>
              <p className="text-body-sm font-medium">This is high contrast body text.</p>
              <div className="bg-white p-2 rounded border-2 border-black">
                <code className="text-xs font-bold">const code = "example";</code>
              </div>
            </div>
          </ThemeTest>

          <ThemeTest theme="lowContrast" contrast="low">
            <div className="space-y-4">
              <h5 className="text-heading-sm">Low Contrast</h5>
              <button className="bg-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-400">
                Primary Button
              </button>
              <p className="text-body-sm text-gray-500">This is low contrast body text.</p>
              <div className="bg-gray-200 p-2 rounded">
                <code className="text-xs text-gray-600">const code = "example";</code>
              </div>
            </div>
          </ThemeTest>
        </div>
      </div>
    </ComponentTester>
  ),
};

// Linear-inspired Hierarchy Testing
export const HierarchyTesting: Story = {
  args: {
    testMode: 'hierarchy'
  },
  render: () => (
    <ComponentTester testMode="hierarchy">
      <div className="space-y-8">
        <div>
          <h2 className="text-display-sm mb-6 text-gray-900">Component Hierarchy Testing</h2>
          <p className="text-body-md text-gray-600 mb-8">
            Testing component relationships and spacing at different hierarchy levels, inspired by Linear's systematic approach.
          </p>
        </div>

        <div className="space-y-8">
          <HierarchyTest level="page">
            <div className="space-y-6">
              <div>
                <h1 className="text-display-lg mb-2">Page Title</h1>
                <p className="text-body-md text-gray-600">This is a page-level component with generous spacing.</p>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700">
                    Primary Action
                  </button>
                  <button className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50">
                    Secondary Action
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">Sort by:</span>
                  <select className="border border-gray-300 rounded px-2 py-1 text-sm">
                    <option>Name</option>
                    <option>Date</option>
                    <option>Status</option>
                  </select>
                </div>
              </div>
            </div>
          </HierarchyTest>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <HierarchyTest level="section">
              <div>
                <h3 className="text-heading-lg mb-4">Section Title</h3>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary-500 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <h4 className="text-heading-sm">Item Title</h4>
                      <p className="text-body-sm text-gray-600">This is item content with appropriate spacing for section-level components.</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-success-500 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <h4 className="text-heading-sm">Another Item</h4>
                      <p className="text-body-sm text-gray-600">More content here showing proper hierarchy and spacing relationships.</p>
                    </div>
                  </div>
                </div>
              </div>
            </HierarchyTest>

            <HierarchyTest level="component">
              <div>
                <h4 className="text-heading-md mb-3">Component Level</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-body-sm font-medium">Setting Name</span>
                    <input type="checkbox" className="rounded" />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-body-sm font-medium">Another Setting</span>
                    <select className="text-sm border border-gray-300 rounded px-2 py-1">
                      <option>Option 1</option>
                      <option>Option 2</option>
                    </select>
                  </div>
                </div>
              </div>
            </HierarchyTest>
          </div>

          <HierarchyTest level="element">
            <div>
              <h5 className="text-heading-sm mb-2">Element Level</h5>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input type="checkbox" className="rounded" />
                  <label className="text-body-sm">Small checkbox option</label>
                </div>

                <div className="flex items-center space-x-2">
                  <input type="radio" name="option" className="rounded-full" />
                  <label className="text-body-sm">Radio option one</label>
                </div>

                <div className="flex items-center space-x-2">
                  <input type="radio" name="option" className="rounded-full" />
                  <label className="text-body-sm">Radio option two</label>
                </div>
              </div>
            </div>
          </HierarchyTest>
        </div>
      </div>
    </ComponentTester>
  ),
};

// Linear-inspired Accessibility Testing
export const AccessibilityTesting: Story = {
  args: {
    testMode: 'accessibility'
  },
  render: () => (
    <ComponentTester testMode="accessibility">
      <div className="space-y-8">
        <div>
          <h2 className="text-display-sm mb-6">Accessibility Testing</h2>
          <p className="text-body-md opacity-75 mb-8">
            Testing accessibility features and keyboard navigation, following Linear's comprehensive accessibility approach.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gray-900 p-6 rounded-lg">
            <h3 className="text-heading-md mb-4">Focus Management</h3>
            <div className="space-y-4">
              <button className="bg-primary-600 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-primary-300 focus:outline-none">
                Focusable Button
              </button>
              <input
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300"
                placeholder="Focusable input"
              />
              <select className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-300">
                <option>Option 1</option>
                <option>Option 2</option>
              </select>
            </div>
          </div>

          <div className="bg-gray-900 p-6 rounded-lg">
            <h3 className="text-heading-md mb-4">Screen Reader Support</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="accessible-input" className="block text-sm font-medium mb-2">
                  Accessible Input Label
                </label>
                <input
                  id="accessible-input"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300"
                  placeholder="This input has proper labeling"
                  aria-describedby="input-help"
                />
                <p id="input-help" className="text-xs text-gray-400 mt-1">
                  This is a helpful description for screen readers.
                </p>
              </div>

              <button
                className="bg-primary-600 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-primary-300 focus:outline-none"
                aria-label="Save your changes"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 p-6 rounded-lg">
          <h3 className="text-heading-md mb-4">Keyboard Navigation</h3>
          <div className="space-y-4">
            <p className="text-body-sm opacity-75 mb-4">
              Use Tab to navigate through interactive elements. Notice how focus is clearly visible.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button className="bg-primary-600 text-white px-3 py-2 rounded text-sm focus:ring-2 focus:ring-primary-300 focus:outline-none">
                Tab 1
              </button>
              <button className="bg-primary-600 text-white px-3 py-2 rounded text-sm focus:ring-2 focus:ring-primary-300 focus:outline-none">
                Tab 2
              </button>
              <button className="bg-primary-600 text-white px-3 py-2 rounded text-sm focus:ring-2 focus:ring-primary-300 focus:outline-none">
                Tab 3
              </button>
              <button className="bg-primary-600 text-white px-3 py-2 rounded text-sm focus:ring-2 focus:ring-primary-300 focus:outline-none">
                Tab 4
              </button>
            </div>

            <div className="space-y-2">
              <input
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300"
                placeholder="Press Tab to focus this input"
              />
              <textarea
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300"
                placeholder="And this textarea"
                rows={3}
              />
            </div>
          </div>
        </div>
      </div>
    </ComponentTester>
  ),
};

// Comprehensive Linear-inspired Testing Suite
export const ComprehensiveTestingSuite: Story = {
  render: () => (
    <div className="space-y-12 p-8">
      <div>
        <h1 className="text-display-xl mb-4">Linear-Inspired Component Testing Suite</h1>
        <p className="text-body-lg text-gray-600 mb-8">
          A comprehensive testing framework inspired by Linear's systematic approach to UI design.
          This suite tests components across multiple dimensions: environment, appearance, hierarchy, and accessibility.
        </p>
      </div>

      {/* Testing Methodology Overview */}
      <div className="bg-gradient-to-r from-primary-50 to-primary-100 p-8 rounded-xl border border-primary-200">
        <h2 className="text-display-sm mb-6 text-primary-900">Testing Methodology</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-heading-sm font-semibold mb-2">Environment</h3>
            <p className="text-body-sm text-gray-600">Cross-platform compatibility and responsive behavior</p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-success-600 rounded-lg flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-heading-sm font-semibold mb-2">Appearance</h3>
            <p className="text-body-sm text-gray-600">Theme consistency and visual hierarchy</p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-warning-600 rounded-lg flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H9a1 1 0 010 2H7.771l.062-.062L8.157 12zM11 12a1 1 0 01.707 1.707l.353.353.062.062H11a1 1 0 010-2z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-heading-sm font-semibold mb-2">Hierarchy</h3>
            <p className="text-body-sm text-gray-600">Component relationships and spacing systems</p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-error-600 rounded-lg flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-heading-sm font-semibold mb-2">Accessibility</h3>
            <p className="text-body-sm text-gray-600">Keyboard navigation and screen reader support</p>
          </div>
        </div>
      </div>

      {/* Real-world Testing Scenarios */}
      <div className="space-y-8">
        <h2 className="text-display-sm">Real-World Testing Scenarios</h2>

        {/* Dashboard Scenario */}
        <div className="border rounded-xl p-8 bg-white shadow-soft">
          <h3 className="text-heading-lg mb-6">Dashboard Scenario</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="text-center p-4 bg-primary-50 rounded-lg">
              <div className="text-2xl font-bold text-primary-600 mb-1">1,234</div>
              <div className="text-sm text-primary-600">Active Users</div>
            </div>
            <div className="text-center p-4 bg-success-50 rounded-lg">
              <div className="text-2xl font-bold text-success-600 mb-1">$12,345</div>
              <div className="text-sm text-success-600">Revenue</div>
            </div>
            <div className="text-center p-4 bg-warning-50 rounded-lg">
              <div className="text-2xl font-bold text-warning-600 mb-1">89%</div>
              <div className="text-sm text-warning-600">Conversion</div>
            </div>
            <div className="text-center p-4 bg-error-50 rounded-lg">
              <div className="text-2xl font-bold text-error-600 mb-1">23</div>
              <div className="text-sm text-error-600">Issues</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <button className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 focus:ring-2 focus:ring-primary-300 focus:outline-none">
              Create Report
            </button>
            <button className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-300 focus:outline-none">
              Export Data
            </button>
            <button className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-300 focus:outline-none">
              Settings
            </button>
          </div>
        </div>

        {/* Form Scenario */}
        <div className="border rounded-xl p-8 bg-white shadow-soft">
          <h3 className="text-heading-lg mb-6">Form Scenario</h3>
          <div className="max-w-md space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter your email"
              />
              <p className="text-xs text-gray-500 mt-1">
                We'll never share your email with anyone else.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={4}
                placeholder="Enter your message"
              />
            </div>

            <div className="flex items-center space-x-4">
              <button className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 focus:ring-2 focus:ring-primary-300 focus:outline-none">
                Send Message
              </button>
              <button className="bg-white text-gray-700 border border-gray-300 px-6 py-2 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-300 focus:outline-none">
                Cancel
              </button>
            </div>
          </div>
        </div>

        {/* Data Table Scenario */}
        <div className="border rounded-xl p-8 bg-white shadow-soft">
          <h3 className="text-heading-lg mb-6">Data Table Scenario</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-heading-md">Recent Transactions</h4>
              <button className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 focus:ring-2 focus:ring-primary-300 focus:outline-none text-sm">
                Export
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Description</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 px-4 text-sm">Jan 15, 2024</td>
                    <td className="py-3 px-4 text-sm">Payment received</td>
                    <td className="py-3 px-4 text-sm font-medium text-success-600">+$1,250.00</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                        Completed
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 px-4 text-sm">Jan 14, 2024</td>
                    <td className="py-3 px-4 text-sm">Subscription renewal</td>
                    <td className="py-3 px-4 text-sm font-medium text-error-600">-$29.99</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning-100 text-warning-800">
                        Pending
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Testing Guidelines */}
      <div className="bg-gray-50 p-8 rounded-xl">
        <h2 className="text-display-sm mb-6">Testing Guidelines</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-heading-md mb-4">Environment Testing</h3>
            <ul className="space-y-2 text-body-sm">
              <li>• Test on desktop, tablet, and mobile viewports</li>
              <li>• Verify touch targets are at least 44px</li>
              <li>• Check text remains readable at all sizes</li>
              <li>• Ensure interactive elements are accessible</li>
            </ul>
          </div>

          <div>
            <h3 className="text-heading-md mb-4">Appearance Testing</h3>
            <ul className="space-y-2 text-body-sm">
              <li>• Test light and dark themes</li>
              <li>• Verify high contrast accessibility</li>
              <li>• Check color contrast ratios (4.5:1 minimum)</li>
              <li>• Ensure consistent visual hierarchy</li>
            </ul>
          </div>

          <div>
            <h3 className="text-heading-md mb-4">Hierarchy Testing</h3>
            <ul className="space-y-2 text-body-sm">
              <li>• Verify consistent spacing scales</li>
              <li>• Check component relationships</li>
              <li>• Test nested component structures</li>
              <li>• Ensure proper visual weight distribution</li>
            </ul>
          </div>

          <div>
            <h3 className="text-heading-md mb-4">Accessibility Testing</h3>
            <ul className="space-y-2 text-body-sm">
              <li>• Test keyboard navigation (Tab order)</li>
              <li>• Verify screen reader compatibility</li>
              <li>• Check focus indicators are visible</li>
              <li>• Ensure proper ARIA labels and roles</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story: 'Complete Linear-inspired testing suite covering all aspects of component quality assurance.'
      }
    }
  }
};
