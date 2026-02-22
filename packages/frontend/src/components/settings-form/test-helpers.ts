import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

export async function fillAllFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/host/i), 'localhost');
  await user.type(screen.getByLabelText(/database/i), 'mydb');
  await user.type(screen.getByLabelText(/username/i), 'admin');
  await user.type(screen.getByLabelText(/password/i), 'secret');
}

type FetchResponse = { ok: boolean; json: () => Promise<unknown> };
type RouteHandler = FetchResponse | (() => FetchResponse);

export function mockFetchRoutes(routes: Record<string, RouteHandler>) {
  return (url: string, options?: RequestInit) => {
    const method = options?.method ?? 'GET';
    const key = `${method} ${url}`;
    const handler = routes[key] ?? routes[url];
    if (handler) {
      const response = typeof handler === 'function' ? handler() : handler;
      return Promise.resolve(response);
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  };
}

export function jsonOk(data: unknown): FetchResponse {
  return { ok: true, json: () => Promise.resolve(data) };
}

export function deferred<T>() {
  let resolve: (value: T) => void;
  let reject: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve: resolve!, reject: reject! };
}
