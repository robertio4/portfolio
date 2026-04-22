import { useCallback, useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          size?: 'normal' | 'compact' | 'invisible';
          theme?: 'light' | 'dark' | 'auto';
          appearance?: 'always' | 'execute' | 'interaction-only';
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
      execute: (widgetId?: string) => void;
    };
  }
}

const SITEKEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

interface UseTurnstileReturn {
  containerRef: React.RefObject<HTMLDivElement>;
  ready: boolean;
  /** Resolves with a fresh token (or rejects). */
  getToken: () => Promise<string>;
}

export function useTurnstile(): UseTurnstileReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const tokenResolvers = useRef<{ resolve: (t: string) => void; reject: (e: Error) => void } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!SITEKEY) {
      console.warn('VITE_TURNSTILE_SITE_KEY missing — Turnstile disabled');
      setReady(true);
      return;
    }
    let cancelled = false;
    const tryRender = () => {
      if (cancelled) return;
      if (!window.turnstile || !containerRef.current) {
        setTimeout(tryRender, 80);
        return;
      }
      if (widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITEKEY,
        size: 'invisible',
        appearance: 'interaction-only',
        callback: (token) => {
          tokenResolvers.current?.resolve(token);
          tokenResolvers.current = null;
        },
        'error-callback': () => {
          tokenResolvers.current?.reject(new Error('turnstile_error'));
          tokenResolvers.current = null;
        },
        'expired-callback': () => {
          if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current);
        },
      });
      setReady(true);
    };
    tryRender();
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, []);

  const getToken = useCallback((): Promise<string> => {
    if (!SITEKEY) return Promise.resolve('dev-no-turnstile');
    if (!window.turnstile || !widgetIdRef.current) {
      return Promise.reject(new Error('turnstile_not_ready'));
    }
    return new Promise<string>((resolve, reject) => {
      tokenResolvers.current = { resolve, reject };
      window.turnstile!.reset(widgetIdRef.current!);
      window.turnstile!.execute(widgetIdRef.current!);
      setTimeout(() => {
        if (tokenResolvers.current) {
          tokenResolvers.current.reject(new Error('turnstile_timeout'));
          tokenResolvers.current = null;
        }
      }, 15_000);
    });
  }, []);

  return { containerRef, ready, getToken };
}
