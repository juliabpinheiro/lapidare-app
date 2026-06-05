/**
 * Netlify Function — proxy para FatSecret API
 * As credenciais ficam no servidor (nunca expostas ao browser).
 *
 * GET /.netlify/functions/fatsecret?q=TERMO      → busca alimentos
 * GET /.netlify/functions/fatsecret?food_id=ID   → detalhe de 1 alimento
 */

// Credenciais OAuth 2.0 — idealmente em variáveis de ambiente no painel Netlify
const CLIENT_ID     = process.env.FATSECRET_CLIENT_ID     || '3663c27798c944729aac4740541d514e';
const CLIENT_SECRET = process.env.FATSECRET_CLIENT_SECRET || 'c8c2b7ccea354621b7ca3918bb1d9c58';

// Cache do token dentro da mesma instância aquecida da função
let _token   = null;
let _expires = 0;

async function getToken() {
  if (_token && Date.now() < _expires) return _token;

  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${creds}`,
    },
    body: 'grant_type=client_credentials&scope=basic',
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Falha ao obter token (${res.status}): ${txt}`);
  }

  const { access_token, expires_in } = await res.json();
  _token   = access_token;
  _expires = Date.now() + (expires_in - 300) * 1000; // renova 5 min antes de expirar
  return _token;
}

function fsApi(token, params) {
  const url = new URL('https://platform.fatsecret.com/rest/server.api');
  Object.entries({ ...params, format: 'json' }).forEach(([k, v]) => url.searchParams.set(k, v));
  return fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
}

/** Extrai macros + serving do food_description da busca */
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

/** Escolhe o melhor serving de um alimento detalhado */
function pickServing(servings) {
  const arr = Array.isArray(servings?.serving)
    ? servings.serving
    : servings?.serving ? [servings.serving] : [];

  if (!arr.length) return {};

  // Prefere serving de 100g
  const s = arr.find(x => parseFloat(x.metric_serving_amount) === 100 && x.metric_serving_unit === 'g')
         ?? arr.find(x => x.serving_description?.toLowerCase().includes('100g'))
         ?? arr[0];

  return {
    serving_desc:   s.serving_description ?? null,
    serving_g:      parseFloat(s.metric_serving_amount) || null,
    serving_unit:   s.metric_serving_unit ?? 'g',
    kcal:           parseFloat(s.calories)      || null,
    prot_g:         parseFloat(s.protein)       || null,
    carb_g:         parseFloat(s.carbohydrate)  || null,
    fat_g:          parseFloat(s.fat)           || null,
    fibra_g:        parseFloat(s.fiber)         || null,
    sodio_mg:       parseFloat(s.sodium)        || null,
  };
}

const HEADERS = {
  'Content-Type':                'application/json',
  'Access-Control-Allow-Origin': '*',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS')
    return { statusCode: 200, headers: HEADERS, body: '' };

  const q       = event.queryStringParameters?.q;
  const food_id = event.queryStringParameters?.food_id;

  if (!q && !food_id)
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Parâmetro q ou food_id obrigatório.' }) };

  try {
    const token = await getToken();

    /* ── DETALHE DE UM ALIMENTO ── */
    if (food_id) {
      const res = await fsApi(token, { method: 'food.get.v2', food_id });
      if (!res.ok) throw new Error(`food.get ${res.status}`);
      const { food } = await res.json();
      if (!food) return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'Alimento não encontrado.' }) };

      return {
        statusCode: 200, headers: HEADERS,
        body: JSON.stringify({
          food_id:    food.food_id,
          name:       food.food_name,
          brand:      food.brand_name   ?? null,
          food_type:  food.food_type    ?? null,
          ...pickServing(food.servings),
        }),
      };
    }

    /* ── BUSCA ── */
    const res = await fsApi(token, { method: 'foods.search', search_expression: q, max_results: 20 });
    if (!res.ok) throw new Error(`foods.search ${res.status}`);
    const data = await res.json();

    const raw  = data?.foods?.food ?? [];
    const list = Array.isArray(raw) ? raw : [raw];

    return {
      statusCode: 200, headers: HEADERS,
      body: JSON.stringify({
        total: data?.foods?.total_results ?? list.length,
        foods: list.map(f => ({
          food_id:     f.food_id,
          name:        f.food_name,
          brand:       f.brand_name   ?? null,
          food_type:   f.food_type    ?? null,
          description: f.food_description ?? null,
          ...parseDesc(f.food_description),
        })),
      }),
    };

  } catch (err) {
    console.error('[fatsecret]', err.message);
    return {
      statusCode: 500, headers: HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
