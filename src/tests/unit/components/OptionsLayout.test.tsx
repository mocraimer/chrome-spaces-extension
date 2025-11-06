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

// Mock import/export service hook to avoid initializing background services in unit tests
jest.mock('../../../options/hooks/useImportExportService', () => ({
  useImportExportService: jest.fn(() => null)
}));

const { useTheme } = require('../../../popup/styles/ThemeProvider') as { useTheme: jest.Mock };

beforeEach(() => {
  useTheme.mockImplementation(() => ({
    isDark: false,
    toggleTheme: jest.fn()
  }));
});

describe('OptionsLayout Component', () => {
  it('should render with light theme by default', () => {
    const { container } = renderWithProviders(<OptionsLayout>Test Content</OptionsLayout>);
    const layoutDiv = container.firstElementChild as HTMLElement | null;
    expect(layoutDiv).not.toBeNull();
    expect(layoutDiv!.classList.contains('light')).toBe(true);
  });

  it('should render with dark theme when isDark is true', () => {
    useTheme.mockReturnValueOnce({
      isDark: true,
      toggleTheme: jest.fn()
    });

    const { container } = renderWithProviders(<OptionsLayout>Test Content</OptionsLayout>);
    const layoutDiv = container.firstElementChild as HTMLElement | null;
    expect(layoutDiv).not.toBeNull();
    expect(layoutDiv!.classList.contains('dark')).toBe(true);
  });

  it('should render header with correct title', () => {
    renderWithProviders(<OptionsLayout>Test Content</OptionsLayout>);
    const header = screen.getByRole('heading', { name: 'Chrome Spaces Settings' });
    expect(header).toBeTruthy();
  });

  it('should render children content in the main section', () => {
    const testChild = 'Test Child Content';
    renderWithProviders(<OptionsLayout>{testChild}</OptionsLayout>);
    const main = screen.getByRole('main');
    expect(main.textContent).toContain(testChild);
  });

  it('should render footer with the current year', () => {
    const currentYear = new Date().getFullYear().toString();
    renderWithProviders(<OptionsLayout>Footer Test</OptionsLayout>);
    const footerText = screen.getByText(/Chrome Spaces ©/);
    expect(footerText.textContent).toContain(currentYear);
  });
});
