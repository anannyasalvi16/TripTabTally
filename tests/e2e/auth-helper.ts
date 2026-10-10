export function createAuthCookie(
  userId = '11111111-1111-1111-1111-111111111111',
  email = 'rohan@example.com'
) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      email: email,
      role: 'authenticated',
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 86400 * 30,
    })
  ).toString('base64url');
  const token = `${header}.${payload}.sig`;

  const raw = JSON.stringify({
    access_token: token,
    refresh_token: 'mock-refresh-token',
    user: { id: userId, email: email },
    token_type: 'bearer',
    expires_in: 86400 * 30,
    expires_at: Math.floor(Date.now() / 1000) + 86400 * 30,
  });

  const val = 'base64-' + Buffer.from(raw).toString('base64');

  return {
    name: 'sb-127-auth-token',
    value: val,
    domain: 'localhost',
    path: '/',
    httpOnly: false,
    secure: false,
    sameSite: 'Lax' as const,
  };
}
