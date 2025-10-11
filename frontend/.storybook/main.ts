import type { StorybookConfig } from '@storybook/react-webpack5';

const config: StorybookConfig = {
  "stories": [
    "../src/**/*.stories.@(js|jsx|ts|tsx)"
  ],
  "addons": [
    "@storybook/preset-create-react-app",
    "@storybook/addon-docs"
  ],
  "framework": {
    "name": "@storybook/react-webpack5",
    "options": {
      builder: {
        viteConfigPath: undefined,
      }
    }
  },
  "staticDirs": [
    "../public"
  ],
  "typescript": {
    "check": false,
    "reactDocgen": false
  }
};
export default config;