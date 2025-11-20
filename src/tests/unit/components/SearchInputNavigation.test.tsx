import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import SearchInput from '../../../popup/components/SearchInput';

describe('SearchInput Navigation', () => {
    it('should stop propagation when onKeyDown handler prevents default', () => {
        const handleKeyDown = jest.fn((e: React.KeyboardEvent) => {
            e.preventDefault();
        });
        const handleContainerKeyDown = jest.fn();

        render(
            <div onKeyDown={handleContainerKeyDown}>
                <SearchInput
                    value=""
                    onChange={() => { }}
                    onKeyDown={handleKeyDown}
                />
            </div>
        );

        const input = screen.getByTestId('search-input');

        // Simulate ArrowDown
        fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });

        // Handler should be called
        expect(handleKeyDown).toHaveBeenCalledTimes(1);

        // Container handler should NOT be called because of stopPropagation
        expect(handleContainerKeyDown).not.toHaveBeenCalled();
    });

    it('should NOT stop propagation when onKeyDown handler does NOT prevent default', () => {
        const handleKeyDown = jest.fn((e: React.KeyboardEvent) => {
            // Do nothing (don't prevent default)
        });
        const handleContainerKeyDown = jest.fn();

        render(
            <div onKeyDown={handleContainerKeyDown}>
                <SearchInput
                    value=""
                    onChange={() => { }}
                    onKeyDown={handleKeyDown}
                />
            </div>
        );

        const input = screen.getByTestId('search-input');

        // Simulate 'a' key
        fireEvent.keyDown(input, { key: 'a', code: 'KeyA' });

        // Handler should be called
        expect(handleKeyDown).toHaveBeenCalledTimes(1);

        // Container handler SHOULD be called
        expect(handleContainerKeyDown).toHaveBeenCalledTimes(1);
    });
});
