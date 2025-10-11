import React from 'react';

export default {
  title: 'Working/Test',
  component: () => React.createElement('div', null, 'Working Component'),
};

export const Working = () => React.createElement('div', {
  style: { padding: '16px', backgroundColor: 'blue', color: 'white' }
}, 'Working Test Story - This should display!');
