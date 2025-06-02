import React from 'react';
import { screen } from '@testing-library/react';
import OptionsLayout from '../../../options/components/layout/OptionsLayout';
import { renderWithProviders } from '../../utils/testUtils';

// Mock the useTheme hook to control the theme
jest.mock('../../../popup/styles/ThemeProvider', () => ({
  useTheme: jest.fn(() => ({
    isDark: false,
    toggleTheme: jest.fn()
  }))
}));

describe('OptionsLayout Component', () => {
  it('should render with light theme by default', () => {
    const { container } = renderWithProviders(<OptionsLayout>Test Content</OptionsLayout>);
    const layoutDiv = container.querySelector('.options-layout');
    expect(layoutDiv).toBeInTheDocument();
    expect(layoutDiv?.className).toContain('light');
  });

  it('should render with dark theme when isDark is true', () => {
    const { useTheme } = require('../../../popup/styles/ThemeProvider');
    useTheme.mockImplementation(() => ({
      isDark: true,
      toggleTheme: jest.fn()
    }));

    const { container } = renderWithProviders(<OptionsLayout>Test Content</OptionsLayout>);
    const layoutDiv = container.querySelector('.options-layout');
    expect(layoutDiv).toBeInTheDocument();
    expect(layoutDiv?.className).toContain('dark');
  });

  it('should render header with correct title', () => {
    renderWithProviders(<OptionsLayout>Test Content</OptionsLayout>);
    const header = screen.getByText('Chrome Spaces Settings');
    expect(header).toBeInTheDocument();
  });

  it('should render children content in the main section', () => {
    const testChild = 'Test Child Content';
    const { container } = renderWithProviders(<OptionsLayout>{testChild}</OptionsLayout>);
    const main = container.querySelector('.options-main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveTextContent(testChild);
  });

  it('should render footer with the current year', () => {
    const currentYear = new Date().getFullYear().toString();
    const { container } = renderWithProviders(<OptionsLayout>Footer Test</OptionsLayout>);
    const footer = container.querySelector('.options-footer');
    expect(footer).toBeInTheDocument();
    expect(footer?.textContent).toContain(currentYear);
  });
});