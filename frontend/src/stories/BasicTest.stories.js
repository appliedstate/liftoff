import React from 'react';

export default {
  title: 'Basic/Test',
  component: () => React.createElement('div', null, 'Basic Test Component'),
};

export const Basic = () => React.createElement('div', { className: 'p-4 bg-green-500 text-white' }, 'Basic Test Story');
