import { useRef } from "react";

type PersistableFunction = (this: unknown, ...args: never[]) => unknown;

/**
 * usePersistFn instead of useCallback to reduce cognitive load
 */
export function usePersistFn<T extends PersistableFunction>(fn: T): T {
  const fnRef = useRef<T>(fn);
  fnRef.current = fn;

  const persistFn = useRef<T | null>(null);
  if (persistFn.current === null) {
    persistFn.current = function (this: ThisParameterType<T>, ...args: Parameters<T>): ReturnType<T> {
      return fnRef.current!.apply(this, args) as ReturnType<T>;
    } as T;
  }

  return persistFn.current;
}
