import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Smart Scheduling navigation', () => {
  render(<App />);
  expect(screen.getByText('Smart Scheduling')).toBeInTheDocument();
  expect(screen.getByText('Predict')).toBeInTheDocument();
  expect(screen.getByText('Model Analytics')).toBeInTheDocument();
});
