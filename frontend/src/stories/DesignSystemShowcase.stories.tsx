import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';

// Linear-Inspired Design System Showcase
const DesignSystemShowcase = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="max-w-7xl mx-auto px-8 py-20">
          <div className="text-center">
            <h1 className="text-display-2xl mb-6">
              Linear-Inspired Design System
            </h1>
            <p className="text-xl opacity-90 max-w-3xl mx-auto leading-relaxed">
              A comprehensive design system built with modern React components,
              following Linear's systematic approach to UI design and development.
            </p>
          </div>
        </div>
      </div>

      {/* Core Principles */}
      <div className="max-w-7xl mx-auto px-8 py-16">
        <div className="text-center mb-16">
          <h2 className="text-display-lg mb-4">Core Design Principles</h2>
          <p className="text-body-lg text-gray-600 max-w-2xl mx-auto">
            Built on Linear's foundation of systematic design, advanced theming, and comprehensive testing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          <div className="text-center p-8 bg-white rounded-xl shadow-soft border border-gray-100">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-heading-lg mb-4">Systematic Approach</h3>
            <p className="text-body-md text-gray-600">
              Every component follows consistent patterns, spacing scales, and design tokens for predictable behavior.
            </p>
          </div>

          <div className="text-center p-8 bg-white rounded-xl shadow-soft border border-gray-100">
            <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-success-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-heading-lg mb-4">Advanced Theming</h3>
            <p className="text-body-md text-gray-600">
              LCH-based color system with automatic contrast adjustments and comprehensive theme support.
            </p>
          </div>

          <div className="text-center p-8 bg-white rounded-xl shadow-soft border border-gray-100">
            <div className="w-16 h-16 bg-warning-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-warning-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H9a1 1 0 010 2H7.771l.062-.062L8.157 12zM11 12a1 1 0 01.707 1.707l.353.353.062.062H11a1 1 0 010-2z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-heading-lg mb-4">Comprehensive Testing</h3>
            <p className="text-body-md text-gray-600">
              Stress-tested across environments, themes, hierarchies, and accessibility requirements.
            </p>
          </div>
        </div>
      </div>

      {/* Typography Showcase */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-12">
            <h2 className="text-display-md mb-4">Typography System</h2>
            <p className="text-body-lg text-gray-600">
              Inter font family with systematic scale and improved readability
            </p>
          </div>

          {/* Font Family */}
          <div className="bg-white rounded-xl p-8 mb-8 border border-gray-200 shadow-soft">
            <h3 className="text-heading-lg mb-6">Inter Font Family</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div className="text-center">
                <div className="font-light text-2xl mb-2">Light</div>
                <div className="text-caption text-gray-500">300</div>
              </div>
              <div className="text-center">
                <div className="font-normal text-2xl mb-2">Regular</div>
                <div className="text-caption text-gray-500">400</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-2xl mb-2">Medium</div>
                <div className="text-caption text-gray-500">500</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-2xl mb-2">Semi-bold</div>
                <div className="text-caption text-gray-500">600</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-2xl mb-2">Bold</div>
                <div className="text-caption text-gray-500">700</div>
              </div>
            </div>
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-body-md text-center">
                "The quick brown fox jumps over the lazy dog"
              </p>
            </div>
          </div>

          {/* Typography Scale */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-soft">
              <h3 className="text-heading-lg mb-6">Display Text</h3>
              <div className="space-y-6">
                <div>
                  <div className="text-display-2xl mb-2">Display 2XL</div>
                  <p className="text-caption text-gray-500">text-display-2xl - Hero sections</p>
                </div>
                <div>
                  <div className="text-display-xl mb-2">Display XL</div>
                  <p className="text-caption text-gray-500">text-display-xl - Major headings</p>
                </div>
                <div>
                  <div className="text-display-lg mb-2">Display LG</div>
                  <p className="text-caption text-gray-500">text-display-lg - Section headers</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-soft">
              <h3 className="text-heading-lg mb-6">Body Text</h3>
              <div className="space-y-6">
                <div>
                  <div className="text-body-lg mb-2">Body Large</div>
                  <p className="text-caption text-gray-500">text-body-lg - Lead paragraphs</p>
                </div>
                <div>
                  <div className="text-body-md mb-2">Body Medium</div>
                  <p className="text-caption text-gray-500">text-body-md - Regular content</p>
                </div>
                <div>
                  <div className="text-body-sm mb-2">Body Small</div>
                  <p className="text-caption text-gray-500">text-body-sm - Secondary content</p>
                </div>
              </div>
            </div>
          </div>

          {/* Usage Guidelines */}
          <div className="bg-primary-50 rounded-xl p-8 border border-primary-200 mt-8">
            <h3 className="text-heading-lg mb-6 text-primary-900">Typography Guidelines</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="text-heading-sm font-semibold text-primary-800 mb-3">Hierarchy</h4>
                <ul className="space-y-2 text-body-sm text-primary-700">
                  <li>• Use semantic heading levels (h1-h6)</li>
                  <li>• Display text for heroes and sections</li>
                  <li>• Headings for content organization</li>
                  <li>• Body text for readable content</li>
                </ul>
              </div>

              <div>
                <h4 className="text-heading-sm font-semibold text-primary-800 mb-3">Weights</h4>
                <ul className="space-y-2 text-body-sm text-primary-700">
                  <li>• Light (300): Large display text</li>
                  <li>• Regular (400): Body text</li>
                  <li>• Medium (500): Emphasis</li>
                  <li>• Semi-bold (600): Headings</li>
                  <li>• Bold (700): Strong emphasis</li>
                </ul>
              </div>

              <div>
                <h4 className="text-heading-sm font-semibold text-primary-800 mb-3">Spacing</h4>
                <ul className="space-y-2 text-body-sm text-primary-700">
                  <li>• Line height: 1.4-1.7x font size</li>
                  <li>• Letter spacing: -0.025em for display</li>
                  <li>• Consistent vertical rhythm</li>
                  <li>• Adequate whitespace</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Color System */}
      <div className="py-16">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-12">
            <h2 className="text-display-md mb-4">Color System</h2>
            <p className="text-body-lg text-gray-600">
              Systematic color palette with semantic naming and accessibility considerations
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
            {/* Primary Colors */}
            <div className="space-y-4">
              <h3 className="text-heading-md font-semibold">Primary</h3>
              <div className="space-y-2">
                <div className="h-12 bg-primary-50 rounded-lg border flex items-center justify-center">
                  <span className="text-xs font-medium">50</span>
                </div>
                <div className="h-12 bg-primary-100 rounded-lg border flex items-center justify-center">
                  <span className="text-xs font-medium text-primary-800">100</span>
                </div>
                <div className="h-12 bg-primary-500 rounded-lg flex items-center justify-center">
                  <span className="text-xs font-medium text-white">500</span>
                </div>
                <div className="h-12 bg-primary-900 rounded-lg flex items-center justify-center">
                  <span className="text-xs font-medium text-white">900</span>
                </div>
              </div>
            </div>

            {/* Success Colors */}
            <div className="space-y-4">
              <h3 className="text-heading-md font-semibold">Success</h3>
              <div className="space-y-2">
                <div className="h-12 bg-success-50 rounded-lg border flex items-center justify-center">
                  <span className="text-xs font-medium">50</span>
                </div>
                <div className="h-12 bg-success-100 rounded-lg border flex items-center justify-center">
                  <span className="text-xs font-medium text-success-800">100</span>
                </div>
                <div className="h-12 bg-success-500 rounded-lg flex items-center justify-center">
                  <span className="text-xs font-medium text-white">500</span>
                </div>
                <div className="h-12 bg-success-900 rounded-lg flex items-center justify-center">
                  <span className="text-xs font-medium text-white">900</span>
                </div>
              </div>
            </div>

            {/* Warning Colors */}
            <div className="space-y-4">
              <h3 className="text-heading-md font-semibold">Warning</h3>
              <div className="space-y-2">
                <div className="h-12 bg-warning-50 rounded-lg border flex items-center justify-center">
                  <span className="text-xs font-medium">50</span>
                </div>
                <div className="h-12 bg-warning-100 rounded-lg border flex items-center justify-center">
                  <span className="text-xs font-medium text-warning-800">100</span>
                </div>
                <div className="h-12 bg-warning-500 rounded-lg flex items-center justify-center">
                  <span className="text-xs font-medium text-white">500</span>
                </div>
                <div className="h-12 bg-warning-900 rounded-lg flex items-center justify-center">
                  <span className="text-xs font-medium text-white">900</span>
                </div>
              </div>
            </div>

            {/* Error Colors */}
            <div className="space-y-4">
              <h3 className="text-heading-md font-semibold">Error</h3>
              <div className="space-y-2">
                <div className="h-12 bg-error-50 rounded-lg border flex items-center justify-center">
                  <span className="text-xs font-medium">50</span>
                </div>
                <div className="h-12 bg-error-100 rounded-lg border flex items-center justify-center">
                  <span className="text-xs font-medium text-error-800">100</span>
                </div>
                <div className="h-12 bg-error-500 rounded-lg flex items-center justify-center">
                  <span className="text-xs font-medium text-white">500</span>
                </div>
                <div className="h-12 bg-error-900 rounded-lg flex items-center justify-center">
                  <span className="text-xs font-medium text-white">900</span>
                </div>
              </div>
            </div>

            {/* Gray Colors */}
            <div className="space-y-4">
              <h3 className="text-heading-md font-semibold">Gray</h3>
              <div className="space-y-2">
                <div className="h-12 bg-gray-50 rounded-lg border flex items-center justify-center">
                  <span className="text-xs font-medium">50</span>
                </div>
                <div className="h-12 bg-gray-100 rounded-lg border flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-800">100</span>
                </div>
                <div className="h-12 bg-gray-500 rounded-lg flex items-center justify-center">
                  <span className="text-xs font-medium text-white">500</span>
                </div>
                <div className="h-12 bg-gray-900 rounded-lg flex items-center justify-center">
                  <span className="text-xs font-medium text-white">900</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Component Showcase */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-12">
            <h2 className="text-display-md mb-4">Component Library</h2>
            <p className="text-body-lg text-gray-600">
              Production-ready components built with systematic design principles
            </p>
          </div>

          {/* Buttons */}
          <div className="mb-16">
            <h3 className="text-heading-lg mb-8">Buttons</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="space-y-4">
                <h4 className="text-heading-sm font-medium">Primary</h4>
                <div className="space-y-3">
                  <button className="w-full bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 focus:ring-2 focus:ring-primary-300 focus:outline-none transition-colors">
                    Primary Button
                  </button>
                  <button className="w-full bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 focus:ring-2 focus:ring-primary-300 focus:outline-none transition-colors opacity-50 cursor-not-allowed">
                    Disabled
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-heading-sm font-medium">Secondary</h4>
                <div className="space-y-3">
                  <button className="w-full bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-300 focus:outline-none transition-colors">
                    Secondary Button
                  </button>
                  <button className="w-full bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-300 focus:outline-none transition-colors opacity-50 cursor-not-allowed">
                    Disabled
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-heading-sm font-medium">Outline</h4>
                <div className="space-y-3">
                  <button className="w-full bg-transparent text-primary-600 border border-primary-600 px-4 py-2 rounded-lg hover:bg-primary-50 focus:ring-2 focus:ring-primary-300 focus:outline-none transition-colors">
                    Outline Button
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-heading-sm font-medium">With Icons</h4>
                <div className="space-y-3">
                  <button className="w-full bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 focus:ring-2 focus:ring-primary-300 focus:outline-none transition-colors flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h3a1 1 0 01.707 1.707l-4 4a1 1 0 01-1.414 0l-4-4A1 1 0 015 9h3V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Download
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Forms */}
          <div className="mb-16">
            <h3 className="text-heading-lg mb-8">Form Components</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h4 className="text-heading-sm font-medium mb-4">Input Fields</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Enter your email"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Enter your password"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Must be at least 8 characters long
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h4 className="text-heading-sm font-medium mb-4">Select & Checkboxes</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Country
                    </label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                      <option>Select a country</option>
                      <option>United States</option>
                      <option>Canada</option>
                      <option>United Kingdom</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                      <span className="ml-2 text-sm text-gray-700">Email notifications</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                      <span className="ml-2 text-sm text-gray-700">SMS notifications</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cards */}
          <div className="mb-16">
            <h3 className="text-heading-lg mb-8">Cards</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-soft">
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <h4 className="text-heading-sm font-medium mb-2">Default Card</h4>
                <p className="text-body-sm text-gray-600">
                  Clean, minimal card with subtle shadow and border.
                </p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-medium">
                <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-success-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <h4 className="text-heading-sm font-medium mb-2">Elevated Card</h4>
                <p className="text-body-sm text-gray-600">
                  Prominent shadow for important content or CTAs.
                </p>
              </div>

              <div className="bg-gradient-to-br from-primary-50 to-primary-100 p-6 rounded-lg border border-primary-200 shadow-soft">
                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                  </svg>
                </div>
                <h4 className="text-heading-sm font-medium mb-2 text-primary-900">Gradient Card</h4>
                <p className="text-body-sm text-primary-700">
                  Beautiful gradient background for featured content.
                </p>
              </div>
            </div>
          </div>

          {/* Status & Feedback */}
          <div className="mb-16">
            <h3 className="text-heading-lg mb-8">Status & Feedback</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h4 className="text-heading-sm font-medium mb-4">Badges</h4>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                    Primary
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                    Success
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning-100 text-warning-800">
                    Warning
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-error-100 text-error-800">
                    Error
                  </span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h4 className="text-heading-sm font-medium mb-4">Alerts</h4>
                <div className="space-y-3">
                  <div className="p-4 bg-success-50 border border-success-200 rounded-lg">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-success-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-success-800">
                          Successfully saved!
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-error-50 border border-error-200 rounded-lg">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-error-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-error-800">
                          There was an error with your submission.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Implementation Guide */}
      <div className="py-16">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-12">
            <h2 className="text-display-md mb-4">Implementation Guide</h2>
            <p className="text-body-lg text-gray-600">
              How to use this design system in your projects
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-heading-lg mb-6">Quick Start</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-medium text-primary-600">1</span>
                  </div>
                  <div>
                    <h4 className="text-heading-sm font-medium mb-1">Import Components</h4>
                    <p className="text-body-sm text-gray-600">
                      Import the design system components into your React application.
                    </p>
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                      <code className="text-sm">
                        import Button from './components/Button';<br/>
                        import Card from './components/Card';
                      </code>
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-medium text-primary-600">2</span>
                  </div>
                  <div>
                    <h4 className="text-heading-sm font-medium mb-1">Use Design Tokens</h4>
                    <p className="text-body-sm text-gray-600">
                      Leverage the CSS custom properties and Tailwind utilities.
                    </p>
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                      <code className="text-sm">
                        .my-component &#123;<br/>
                        &nbsp;&nbsp;background-color: rgb(var(--color-surface));<br/>
                        &nbsp;&nbsp;color: rgb(var(--color-text-primary));<br/>
                        &#125;
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-heading-lg mb-6">Best Practices</h3>
              <div className="space-y-4">
                <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
                  <h4 className="text-heading-sm font-medium text-primary-900 mb-2">
                    Consistency First
                  </h4>
                  <p className="text-body-sm text-primary-700">
                    Always use the design system components and tokens to maintain consistency across your application.
                  </p>
                </div>

                <div className="p-4 bg-success-50 rounded-lg border border-success-200">
                  <h4 className="text-heading-sm font-medium text-success-900 mb-2">
                    Accessibility Matters
                  </h4>
                  <p className="text-body-sm text-success-700">
                    All components include proper ARIA labels, focus management, and keyboard navigation support.
                  </p>
                </div>

                <div className="p-4 bg-warning-50 rounded-lg border border-warning-200">
                  <h4 className="text-heading-sm font-medium text-warning-900 mb-2">
                    Test Thoroughly
                  </h4>
                  <p className="text-body-sm text-warning-700">
                    Use the component testing framework to verify behavior across different environments and themes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-8 text-center">
          <h3 className="text-heading-lg mb-4">Ready to Build</h3>
          <p className="text-body-md opacity-75 mb-8 max-w-2xl mx-auto">
            This Linear-inspired design system provides everything you need to create beautiful,
            consistent, and accessible user interfaces. Start exploring the components and build
            something amazing.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-primary-600 text-white px-8 py-3 rounded-lg hover:bg-primary-700 focus:ring-2 focus:ring-primary-300 focus:outline-none transition-colors">
              View Components
            </button>
            <button className="bg-white text-gray-900 px-8 py-3 rounded-lg hover:bg-gray-100 focus:ring-2 focus:ring-gray-300 focus:outline-none transition-colors">
              Documentation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const meta = {
  title: 'Design System/Showcase',
  component: DesignSystemShowcase,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Complete Linear-inspired design system showcase demonstrating typography, colors, components, and implementation guidelines.'
      }
    }
  },
  tags: ['autodocs'],
} satisfies Meta<typeof DesignSystemShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: () => <DesignSystemShowcase />,
};
