import { parseOAuthCallback } from './oauth-callback.ts';

type AuthResult = { error: Error | null };
type OAuthClient = {
  signInWithOAuth: (request: {
    provider: 'google';
    options: { redirectTo: string; skipBrowserRedirect: true };
  }) => Promise<{ data: { url: string | null }; error: Error | null }>;
  setSession: (session: { access_token: string; refresh_token: string }) => Promise<AuthResult>;
  exchangeCodeForSession: (code: string) => Promise<AuthResult>;
};
type BrowserResult = { type: 'success'; url: string } | { type: string };

export async function runNativeGoogleOAuth(
  client: OAuthClient,
  redirectTo: string,
  open: (url: string, redirectTo: string) => Promise<BrowserResult>,
): Promise<void> {
  const { data, error } = await client.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Google 로그인 주소를 받지 못했습니다.');
  const result = await open(data.url, redirectTo);
  if (result.type !== 'success' || !('url' in result)) {
    throw new Error('GOOGLE_LOGIN_CANCELLED');
  }
  const callback = parseOAuthCallback(result.url);
  if (callback.kind === 'error') throw new Error(callback.message);
  const response = callback.kind === 'code'
    ? await client.exchangeCodeForSession(callback.code)
    : await client.setSession({ access_token: callback.accessToken, refresh_token: callback.refreshToken });
  if (response.error) throw response.error;
}
