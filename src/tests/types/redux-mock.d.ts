import { AppState } from '../../popup/store/types';

declare module '../../popup/store' {
  export function useAppSelector<T>(selector: (state: AppState) => T): T;
  export function useAppDispatch(): jest.Mock;
}

declare global {
  namespace jest {
    interface Mock<T = any, Y extends any[] = any> {
      mockReturnValue(value: T): this;
      mockImplementation(fn: (...args: Y) => T): this;
      mockResolvedValue(value: Awaited<T>): this;
    }
  }
}