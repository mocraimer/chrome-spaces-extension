declare module 'react-window' {
  import * as React from 'react';

  export interface ListChildComponentProps<T = any> {
    index: number;
    style: React.CSSProperties;
    data?: T;
  }

  export interface FixedSizeListProps<T = any> {
    children: (props: ListChildComponentProps<T>) => React.ReactElement;
    className?: string;
    height: number;
    itemCount: number;
    itemSize: number;
    width: number;
    itemData?: T;
    overscanCount?: number;
  }

  export class FixedSizeList<T = any> extends React.Component<FixedSizeListProps<T>> {}
}

declare module 'react-virtualized-auto-sizer' {
  import * as React from 'react';

  interface AutoSizerProps {
    children: (size: { width: number; height: number }) => React.ReactNode;
    defaultHeight?: number;
    defaultWidth?: number;
    disableHeight?: boolean;
    disableWidth?: boolean;
    onResize?: (size: { width: number; height: number }) => void;
    style?: React.CSSProperties;
  }

  export default class AutoSizer extends React.Component<AutoSizerProps> {}
}