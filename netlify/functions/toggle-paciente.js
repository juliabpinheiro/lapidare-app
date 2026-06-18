exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const SUPABASE_URL      = process.env.VITE_SUPABASE_URL;
  const ANON_KEY          = process.env.VITE_SUPABASE_ANON_KEY;
  const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Env vars ausentes no servidor' }) };
  }

  // Verifica JWT da nutri logada
  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token ausente' }) };
  }

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY },
  });
  if (!userRes.ok) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token inválido' }) };
  }
  const { id: nutriId } = await userRes.json();

  // Parse body
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON inválido' }) }; }

  const { paciente_id, ativo } = body;
  if (!paciente_id || typeof ativo !== 'boolean') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Parâmetros inválidos: paciente_id e ativo (boolean) são obrigatórios' }) };
  }

  // Update com service role — bypassa RLS, mas verifica nutri_id para segurança
  const updateRes = await fetch(
    `${SUPABASE_URL}/rest/v1/pacientes?id=eq.${paciente_id}&nutri_id=eq.${nutriId}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ ativo }),
    }
  );

  const text = await updateRes.text();
  if (!updateRes.ok) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: text }) };
  }

  const rows = JSON.parse(text);
  if (!rows || rows.length === 0) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Paciente não encontrada ou não pertence a esta nutri' }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
};
