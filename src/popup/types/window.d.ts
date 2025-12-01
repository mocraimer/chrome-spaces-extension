interface Window {
  visualViewport?: {
    width: number;
    height: number;
    scale: number;
    offsetLeft: number;
    offsetTop: number;
    pageLeft: number;
    pageTop: number;
    addEventListener(type: string, listener: EventListener): void;
    removeEventListener(type: string, listener: EventListener): void;
  };
  innerWidth: number;
  innerHeight: number;
}

interface VisualViewport {
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  readonly offsetLeft: number;
  readonly offsetTop: number;
  readonly pageLeft: number;
  readonly pageTop: number;
  addEventListener(type: string, callback: EventListener | null): void;
  removeEventListener(type: string, callback: EventListener | null): void;
}

declare let visualViewport: VisualViewport | null;
