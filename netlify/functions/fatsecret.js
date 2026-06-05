/**
 * Netlify Function — proxy para FatSecret API
 * Credenciais ficam no servidor, nunca no cliente.
 *
 * GET /.netlify/functions/fatsecret?q=TERMO      → busca alimentos
 * GET /.netlify/functions/fatsecret?food_id=ID   → detalhe de 1 alimento
 */

const CLIENT_ID     = process.env.FATSECRET_CLIENT_ID     || '3663c27798c944729aac4740541d514e';
const CLIENT_SECRET = process.env.FATSECRET_CLIENT_SECRET || 'c8c2b7ccea354621b7ca3918bb1d9c58';

// Cache do token (persiste na instância aquecida)
let _token   = null;
let _expires = 0;

async function getToken() {
  if (_token && Date.now() < _expires) {
    console.log('[fatsecret] usando token cacheado');
    return _token;
  }

  console.log('[fatsecret] obtendo novo token...');
  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  const res = await fetch('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${creds}`,
    },
    body: 'grant_type=client_credentials&scope=basic',
  });

  const raw = await res.text();
  console.log(`[fatsecret] token response status=${res.status} body=${raw.slice(0, 200)}`);

  if (!res.ok) {
    throw new Error(`Falha OAuth (${res.status}): ${raw}`);
  }

  let json;
  try { json = JSON.parse(raw); } catch (e) {
    throw new Error(`Resposta de token inválida: ${raw.slice(0, 100)}`);
  }

  if (!json.access_token) {
    throw new Error(`Token não retornado: ${JSON.stringify(json)}`);
  }

  _token   = json.access_token;
  _expires = Date.now() + ((json.expires_in ?? 86400) - 300) * 1000;
  console.log(`[fatsecret] token obtido, expira em ${json.expires_in}s`);
  return _token;
}

async function fsCall(token, params) {
  const url = new URL('https://platform.fatsecret.com/rest/server.api');
  const allParams = { ...params, format: 'json' };
  Object.entries(allParams).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  console.log(`[fatsecret] chamando ${url.toString().replace(url.origin, '')}`);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  const raw = await res.text();
  console.log(`[fatsecret] API status=${res.status} body=${raw.slice(0, 300)}`);

  if (!res.ok) {
    throw new Error(`API HTTP ${res.status}: ${raw.slice(0, 200)}`);
  }

  let data;
  try { data = JSON.parse(raw); } catch (e) {
    throw new Error(`Resposta não-JSON: ${raw.slice(0, 100)}`);
  }

  // FatSecret retorna erros com HTTP 200 e campo "error"
  if (data.error) {
    const msg = typeof data.error === 'object'
      ? `${data.error.code}: ${data.error.message}`
      : String(data.error);
    throw new Error(`FatSecret error — ${msg}`);
  }

  return data;
}

function parseDesc(desc) {
  if (!desc) return {};
  return {
    serving: desc.match(/Per\s+(.*?)\s*-/i)?.[1]?.trim() ?? null,
    kcal:    parseFloat(desc.match(/Calories:\s*([\d.]+)/i)?.[1])  || null,
    fat_g:   parseFloat(desc.match(/Fat:\s*([\d.]+)/i)?.[1])       || null,
    carb_g:  parseFloat(desc.match(/Carbs:\s*([\d.]+)/i)?.[1])     || null,
    prot_g:  parseFloat(desc.match(/Protein:\s*([\d.]+)/i)?.[1])   || null,
  };
}

function pickServing(servings) {
  const arr = Array.isArray(servings?.serving)
    ? servings.serving
    : servings?.serving ? [servings.serving] : [];
  if (!arr.length) return {};

  const s = arr.find(x => parseFloat(x.metric_serving_amount) === 100 && x.metric_serving_unit === 'g')
         ?? arr.find(x => x.serving_description?.toLowerCase().includes('100'))
         ?? arr[0];

  return {
    serving_desc: s.serving_description   ?? null,
    serving_g:    parseFloat(s.metric_serving_amount) || null,
    serving_unit: s.metric_serving_unit   ?? 'g',
    kcal:         parseFloat(s.calories)      || null,
    prot_g:       parseFloat(s.protein)       || null,
    carb_g:       parseFloat(s.carbohydrate)  || null,
    fat_g:        parseFloat(s.fat)           || null,
    fibra_g:      parseFloat(s.fiber)         || null,
    sodio_mg:     parseFloat(s.sodium)        || null,
  };
}

const H = {
  'Content-Type':                'application/json',
  'Access-Control-Allow-Origin': '*',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS')
    return { statusCode: 200, headers: H, body: '' };

  const q       = event.queryStringParameters?.q;
  const food_id = event.queryStringParameters?.food_id;

  console.log(`[fatsecret] request q=${q} food_id=${food_id}`);

  if (!q && !food_id)
    return { statusCode: 400, headers: H, body: JSON.stringify({ error: 'Parâmetro q ou food_id obrigatório.' }) };

  try {
    const token = await getToken();

    /* ── DETALHE ── */
    if (food_id) {
      const data = await fsCall(token, { method: 'food.get.v2', food_id });
      const food = data?.food;
      if (!food) throw new Error('Campo "food" ausente na resposta');

      return {
        statusCode: 200, headers: H,
        body: JSON.stringify({
          food_id:   food.food_id,
          name:      food.food_name,
          brand:     food.brand_name  ?? null,
          food_type: food.food_type   ?? null,
          ...pickServing(food.servings),
        }),
      };
    }

    /* ── BUSCA ── */
    const data = await fsCall(token, {
      method:            'foods.search',
      search_expression: q,
      max_results:       20,
      page_number:       0,
    });

    console.log(`[fatsecret] foods keys: ${Object.keys(data?.foods ?? {}).join(', ')}`);

    const raw  = data?.foods?.food;
    if (raw == null) {
      // Sem resultados — FatSecret omite o campo "food" quando vazio
      console.log('[fatsecret] sem resultados (campo food ausente)');
      return { statusCode: 200, headers: H, body: JSON.stringify({ total: 0, foods: [] }) };
    }

    const list = Array.isArray(raw) ? raw : [raw];
    return {
      statusCode: 200, headers: H,
      body: JSON.stringify({
        total: parseInt(data?.foods?.total_results ?? list.length, 10),
        foods: list.map(f => ({
          food_id:     f.food_id,
          name:        f.food_name,
          brand:       f.brand_name      ?? null,
          food_type:   f.food_type       ?? null,
          description: f.food_description ?? null,
          ...parseDesc(f.food_description),
        })),
      }),
    };

  } catch (err) {
    console.error('[fatsecret] ERRO:', err.message);
    return {
      statusCode: 500, headers: H,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
