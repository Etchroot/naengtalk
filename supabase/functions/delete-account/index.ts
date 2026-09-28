const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: 'POST 요청만 지원합니다.' });

  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return json(401, { error: '로그인이 필요합니다.' });
  try {
    const body = await request.json();
    if (body?.confirm !== 'DELETE') return json(400, { error: '삭제 확인이 필요합니다.' });
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || !serviceRoleKey) return json(503, { error: '서버 설정이 필요합니다.' });

    const userResponse = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anonKey, authorization },
    });
    if (!userResponse.ok) return json(401, { error: '로그인이 만료되었습니다.' });
    const user = await userResponse.json() as { id?: string };
    if (!user.id || !/^[0-9a-f-]{36}$/i.test(user.id)) return json(401, { error: '사용자를 확인하지 못했습니다.' });

    const deleted = await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
      method: 'DELETE',
      headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` },
    });
    if (!deleted.ok) return json(502, { error: '계정을 삭제하지 못했습니다.' });
    return json(200, { deleted: true });
  } catch {
    return json(500, { error: '계정을 삭제하지 못했습니다.' });
  }
});
