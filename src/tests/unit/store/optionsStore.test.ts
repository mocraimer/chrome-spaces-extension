import { store } from '../../../options/store';

describe('Options Store Initialization', () => {
  it('should initialize the store with a defined state', () => {
    const state = store.getState();
    expect(state).toBeDefined();
  });
});