import { openAuthUrl, isTauri } from './api';

const AUTH_CALLBACK_PATH = '/auth/callback';

export interface AuthConfig {
  authBaseUrl: string;
  clientId?: string;
}

export function getAuthUrl(config: AuthConfig): string {
  const params = new URLSearchParams({
    redirect_uri: isTauri()
      ? `fosforescent://auth/callback`
      : `${window.location.origin}${AUTH_CALLBACK_PATH}`,
    response_type: 'code',
  });

  if (config.clientId) {
    params.set('client_id', config.clientId);
  }

  return `${config.authBaseUrl}/login?${params.toString()}`;
}

export async function initiateAuth(config: AuthConfig): Promise<void> {
  const authUrl = getAuthUrl(config);

  if (isTauri()) {
    await openAuthUrl(authUrl);
  } else {
    window.location.href = authUrl;
  }
}

export function setupDeepLinkHandler(
  onAuthCallback: (code: string) => void
): (() => void) | undefined {
  if (!isTauri()) {
    return undefined;
  }

  const handleDeepLink = (event: Event) => {
    const customEvent = event as CustomEvent<string>;
    const url = customEvent.detail;

    if (url.includes('auth/callback')) {
      const urlObj = new URL(url.replace('fosforescent://', 'http://localhost/'));
      const code = urlObj.searchParams.get('code');
      if (code) {
        onAuthCallback(code);
      }
    }
  };

  window.addEventListener('tauri://deep-link', handleDeepLink as EventListener);

  return () => {
    window.removeEventListener('tauri://deep-link', handleDeepLink as EventListener);
  };
}

export function isDesktopApp(): boolean {
  return isTauri();
}
