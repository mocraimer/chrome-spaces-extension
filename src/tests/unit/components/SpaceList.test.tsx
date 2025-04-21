import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import { Store } from '@reduxjs/toolkit';
import { SpaceList } from '../../../popup/components/SpaceList';
import { selectSpace } from '../../../popup/store/slices/spacesSlice';
import { RootState } from '../../../popup/store/types';

const mockStore = configureStore([]);

describe('SpaceList', () => {
  const mockSpaces = {
    'space-1': {
      id: 'space-1',
      name: 'Test Space 1',
      urls: ['https://test1.com'],
      lastModified: Date.now(),
      named: false,
      version: 1
    },
    'space-2': {
      id: 'space-2',
      name: 'Test Space 2',
      urls: ['https://test2.com', 'https://test3.com'],
      lastModified: Date.now(),
      named: false,
      version: 1
    }
  };

  const mockOnSpaceAction = jest.fn();
  let store: Store<RootState>;

  beforeEach(() => {
    store = mockStore({
      spaces: {
        list: [],
        selectedSpaceId: null,
        currentWindowId: null,
        editMode: false,
        isLoading: false,
        error: null
      }
    }) as Store<RootState>;
    store.dispatch = jest.fn();
  });

  it('renders list of spaces', () => {
    render(
      <Provider store={store}>
        <SpaceList
          spaces={mockSpaces}
          type="active"
          onSpaceAction={mockOnSpaceAction}
        />
      </Provider>
    );

    expect(screen.getByText('Test Space 1')).toBeInTheDocument();
    expect(screen.getByText('Test Space 2')).toBeInTheDocument();
    expect(screen.getByText('1 tab')).toBeInTheDocument();
    expect(screen.getByText('2 tabs')).toBeInTheDocument();
  });

  it('shows empty state when no spaces', () => {
    render(
      <Provider store={store}>
        <SpaceList
          spaces={{}}
          type="active"
          onSpaceAction={mockOnSpaceAction}
        />
      </Provider>
    );

    expect(screen.getByText('No active spaces found')).toBeInTheDocument();
  });

  it('handles space selection', () => {
    render(
      <Provider store={store}>
        <SpaceList
          spaces={mockSpaces}
          type="active"
          onSpaceAction={mockOnSpaceAction}
        />
      </Provider>
    );

    fireEvent.click(screen.getByText('Test Space 1'));
    expect(store.dispatch).toHaveBeenCalledWith(selectSpace('space-1'));
  });

  it('handles space actions', () => {
    render(
      <Provider store={store}>
        <SpaceList
          spaces={mockSpaces}
          type="active"
          onSpaceAction={mockOnSpaceAction}
        />
      </Provider>
    );

    const switchButtons = screen.getAllByText('Switch');
    fireEvent.click(switchButtons[0]);
    expect(mockOnSpaceAction).toHaveBeenCalledWith('space-1', 'switch');
  });

  it('shows edit icons when in edit mode', () => {
    store = mockStore({
      spaces: {
        list: [],
        selectedSpaceId: null,
        currentWindowId: null,
        editMode: true,
        isLoading: false,
        error: null
      }
    }) as Store<RootState>;

    render(
      <Provider store={store}>
        <SpaceList
          spaces={mockSpaces}
          type="active"
          onSpaceAction={mockOnSpaceAction}
        />
      </Provider>
    );

    const editButtons = screen.getAllByTitle('Edit space name');
    expect(editButtons).toHaveLength(2);
  });
});