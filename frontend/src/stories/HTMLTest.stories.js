export default {
  title: 'HTML/Test',
  component: () => document.createElement('div'),
};

export const HTMLTest = () => {
  const div = document.createElement('div');
  div.style.padding = '16px';
  div.style.backgroundColor = 'red';
  div.style.color = 'white';
  div.textContent = 'HTML Test Story - Pure DOM';
  return div;
};
