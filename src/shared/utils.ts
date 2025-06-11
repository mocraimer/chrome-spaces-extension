import { ErrorMessages, ActionTypes, MessageTypes } from './constants';
import type { Space } from './types/Space';

// Safety-focused type checks
const checks = {
  isObj: (x: unknown): x is object => x !== null && typeof x === 'object',
  hasProps: <T extends string>(obj: object, ...props: T[]): obj is Record<T, unknown> => 
    props.every(p => p in obj),
  isArr: Array.isArray
};

// Essential error handling
const err = (msg: string, code: keyof typeof ErrorMessages, src?: Error) => {
  const e = new Error(msg);
  e.name = 'SpacesError';
  Object.assign(e, { code, src });
  return e;
};

// Core API operations wrapper
const chromeOp = async <T>(
  op: () => Promise<T> | T,
  errKey: keyof typeof ErrorMessages
): Promise<T> => {
  try {
    const res = await op();
    const chromeErr = chrome.runtime.lastError;
    if (chromeErr) throw err(chromeErr.message || ErrorMessages[errKey], errKey);
    return res;
  } catch (e) {
    throw err(e instanceof Error ? e.message : ErrorMessages[errKey], errKey, e instanceof Error ? e : undefined);
  }
};

// Type guards
const guards = {
  space: (x: unknown): x is Space => {
    if (!checks.isObj(x)) return false;
    
    // Required fields
    const requiredFields = ['id', 'name', 'urls', 'lastModified', 'named', 'permanentId', 'createdAt', 'lastUsed', 'isActive', 'version'] as const;
    if (!checks.hasProps(x, ...requiredFields)) return false;
    
    // Type checks
    if (!checks.isArr((x as any).urls)) return false;
    if (typeof (x as any).named !== 'boolean') return false;
    if (typeof (x as any).isActive !== 'boolean') return false;
    if (typeof (x as any).version !== 'number') return false;
    if (typeof (x as any).lastModified !== 'number') return false;
    if (typeof (x as any).createdAt !== 'number') return false;
    if (typeof (x as any).lastUsed !== 'number') return false;
    
    // Optional fields type checks
    const obj = x as any;
    if (obj.customName !== undefined && typeof obj.customName !== 'string') return false;
    if (obj.windowId !== undefined && typeof obj.windowId !== 'number') return false;
    if (obj.sourceWindowId !== undefined && typeof obj.sourceWindowId !== 'string') return false;
    if (obj.lastSync !== undefined && typeof obj.lastSync !== 'number') return false;
    
    return true;
  },
  
  // Legacy space guard for migration purposes
  legacySpace: (x: unknown): boolean =>
    checks.isObj(x) &&
    checks.hasProps(x, 'id', 'name', 'urls', 'lastModified', 'named') &&
    checks.isArr((x as any).urls) &&
    typeof (x as any).named === 'boolean',
  
  action: (x: unknown): x is keyof typeof ActionTypes | keyof typeof MessageTypes => {
    if (typeof x !== 'string' || x.length === 0) return false;
    const validActions = [
      ...Object.values(ActionTypes),
      ...Object.values(MessageTypes)
    ];
    return validActions.includes(x as any);
  }
};

// JSON safety
const safeJSON = <T>(
  str: string,
  guard: (x: unknown) => x is T
): T | null => {
  try {
    const val = JSON.parse(str);
    return guard(val) ? val : null;
  } catch {
    return null;
  }
};

// Timing utilities
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const throttle = <F extends (...args: any[]) => any>(
  fn: F,
  wait: number
) => {
  let last = 0;
  return (...args: Parameters<F>): ReturnType<F> | undefined => {
    const now = Date.now();
    if (now - last >= wait) {
      last = now;
      return fn(...args);
    }
  };
};

const debounce = <F extends (...args: any[]) => any>(
  fn: F,
  wait: number
) => {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<F>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
};

// DOM helpers
const dom = {
  create: <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    props: Partial<HTMLElementTagNameMap[K]> = {}
  ) => Object.assign(document.createElement(tag), props),

  on: <T extends Event>(
    el: EventTarget,
    type: string,
    fn: (e: T) => void,
    opts?: boolean | AddEventListenerOptions
  ) => el.addEventListener(type, fn as EventListener, opts)
};

// URL operations
const urls = {
  clean: (url: string) => url.split('#')[0].split('?')[0],
  domain: (url: string) => new URL(url).hostname
};

export {
  chromeOp as executeChromeApi,
  guards as typeGuards,
  safeJSON as safeJSONParse,
  delay,
  throttle,
  debounce,
  dom,
  urls,
  err as createError
};
