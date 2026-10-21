/**
 * Network requests that work from a page loaded off the filesystem.
 *
 * The Android build serves its page from file://, which browsers treat as an
 * opaque origin: a cross-origin fetch from there is refused before it is
 * ever sent, whatever the server allows. That is why the product database
 * reported "нет связи" on a phone with working internet, and the same wall
 * stood in front of the model API.
 *
 * So when the shell is present, requests are handed to it and made natively,
 * where no origin rule applies. In a browser — the web build — plain fetch
 * is used, because there the origin is real and CORS works as designed.
 */

export interface NetResponse {
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

export interface NetInit {
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly signal?: AbortSignal;
}

interface NativeReply {
  readonly id: string;
  readonly status: number;
  readonly body?: string;
  readonly error?: string;
}

declare global {
  interface Window {
    /** Called by the Android shell when a native request finishes. */
    __fastloopHttp?: (payload: string) => void;
  }
}

const pending = new Map<string, (reply: NativeReply) => void>();
let counter = 0;

function bridge(): { httpRequest(id: string, method: string, url: string, headers: string, body: string): void } | null {
  const native = typeof window === 'undefined' ? undefined : window.FastLoopNative;
  return native && typeof (native as { httpRequest?: unknown }).httpRequest === 'function'
    ? (native as unknown as { httpRequest(id: string, method: string, url: string, headers: string, body: string): void })
    : null;
}

function install(): void {
  if (typeof window === 'undefined' || window.__fastloopHttp) return;
  window.__fastloopHttp = (payload: string) => {
    let reply: NativeReply;
    try {
      reply = JSON.parse(payload) as NativeReply;
    } catch {
      return;
    }
    const settle = pending.get(reply.id);
    if (!settle) return;
    pending.delete(reply.id);
    settle(reply);
  };
}

function wrap(status: number, body: string): NetResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    json: async () => JSON.parse(body) as unknown,
  };
}

const TIMEOUT_MS = 45_000;

export async function netFetch(url: string, init: NetInit = {}): Promise<NetResponse> {
  const host = bridge();
  if (!host) {
    const response = await fetch(url, {
      method: init.method,
      headers: init.headers,
      body: init.body,
      signal: init.signal,
    });
    const body = await response.text();
    return wrap(response.status, body);
  }

  install();
  counter += 1;
  const id = `r${counter}`;

  return new Promise<NetResponse>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pending.delete(id);
      reject(new Error('timeout'));
    }, TIMEOUT_MS);

    pending.set(id, (reply) => {
      window.clearTimeout(timer);
      if (reply.status === 0) {
        reject(new Error(reply.error ?? 'network'));
        return;
      }
      resolve(wrap(reply.status, reply.body ?? ''));
    });

    try {
      host.httpRequest(id, init.method ?? 'GET', url, JSON.stringify(init.headers ?? {}), init.body ?? '');
    } catch (failure) {
      window.clearTimeout(timer);
      pending.delete(id);
      reject(failure instanceof Error ? failure : new Error('bridge'));
    }
  });
}
