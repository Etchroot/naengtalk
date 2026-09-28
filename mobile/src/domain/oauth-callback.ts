export type OAuthCallback =
  | { kind: 'session'; accessToken: string; refreshToken: string }
  | { kind: 'code'; code: string }
  | { kind: 'error'; message: string };

export function parseOAuthCallback(url: string): OAuthCallback {
  const parsed = new URL(url);
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const value = (key: string) => fragment.get(key) ?? parsed.searchParams.get(key);
  const error = value('error');
  if (error) return { kind: 'error', message: value('error_description') ?? error };
  const accessToken = value('access_token');
  const refreshToken = value('refresh_token');
  if (accessToken && refreshToken) {
    return { kind: 'session', accessToken, refreshToken };
  }
  const code = value('code');
  if (code) return { kind: 'code', code };
  return { kind: 'error', message: '로그인 응답에 인증 정보가 없습니다.' };
}
