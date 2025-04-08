import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import { Store } from '@reduxjs/toolkit';
import SpaceItem from '../../../popup/components/SpaceItem';
import { RootState } from '../../../popup/store/types';

const mockStore = configureStore([]);

describe('SpaceItem', () => {
  const mockSpace = {
    id: 'test-space-1',
    name: 'Test Space',
    urls: ['https://test1.com'],
    lastModified: Date.now(),
    named: false
  };

  const mockOnSwitchClick = jest.fn();
  let store: Store<RootState>;

  beforeEach(() => {
    store = mockStore({
      spaces: {
        list: [],
        selectedSpaceId: null,
        currentWindowId: null,
        editMode: false,
        isLoading: false,
        error: null,
        searchQuery: ''
      }
    }) as Store<RootState>;
    store.dispatch = jest.fn();
  });

  it('renders space name and tab count', () => {
    render(
      <Provider store={store}>
        <SpaceItem
          space={mockSpace}
          isEditing={false}
          onSwitchClick={mockOnSwitchClick}
          showActions={true}
          actionLabel="Switch"
        />
      </Provider>
    );

    expect(screen.getByText('Test Space')).toBeInTheDocument();
    expect(screen.getByText('1 tab')).toBeInTheDocument();
  });

  it('shows edit interface when isEditing is true', () => {
    render(
      <Provider store={store}>
        <SpaceItem
          space={mockSpace}
          isEditing={true}
          onSwitchClick={mockOnSwitchClick}
          showActions={true}
          actionLabel="Switch"
        />
      </Provider>
    );

    expect(screen.getByTestId('space-name-input')).toHaveValue('Test Space');
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('dispatches update action on save', () => {
    render(
      <Provider store={store}>
        <SpaceItem
          space={mockSpace}
          isEditing={true}
          onSwitchClick={mockOnSwitchClick}
          showActions={true}
          actionLabel="Switch"
        />
      </Provider>
    );

    const input = screen.getByTestId('space-name-input');
    fireEvent.change(input, { target: { value: 'Updated Space' } });
    fireEvent.click(screen.getByText('Save'));

    expect(store.dispatch).toHaveBeenCalledWith({
      type: 'spaces/updateSpaceName',
      payload: { id: mockSpace.id, name: 'Updated Space' }
    });
  });

  it('calls onSwitchClick when action button is clicked', () => {
    render(
      <Provider store={store}>
        <SpaceItem
          space={mockSpace}
          isEditing={false}
          onSwitchClick={mockOnSwitchClick}
          showActions={true}
          actionLabel="Switch"
        />
      </Provider>
    );

    fireEvent.click(screen.getByText('Switch'));
    expect(mockOnSwitchClick).toHaveBeenCalled();
  });

  it('does not show action button when showActions is false', () => {
    render(
      <Provider store={store}>
        <SpaceItem
          space={mockSpace}
          isEditing={false}
          onSwitchClick={mockOnSwitchClick}
          showActions={false}
          actionLabel="Switch"
        />
      </Provider>
    );

    expect(screen.queryByText('Switch')).not.toBeInTheDocument();
  });

  it('resets input value on cancel', () => {
    render(
      <Provider store={store}>
        <SpaceItem
          space={mockSpace}
          isEditing={true}
          onSwitchClick={mockOnSwitchClick}
          showActions={true}
          actionLabel="Switch"
        />
      </Provider>
    );

    const input = screen.getByTestId('space-name-input');
    fireEvent.change(input, { target: { value: 'Changed Name' } });
    fireEvent.click(screen.getByText('Cancel'));

    expect(input).toHaveValue('Test Space');
  });
});