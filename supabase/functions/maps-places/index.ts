import { corsHeaders } from '../_shared/cors.ts';

// Google Places Autocomplete — server-side (API key never exposed to client)
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { input, sessiontoken } = await req.json();
    if (!input || input.trim().length < 2) {
      return new Response(JSON.stringify({ predictions: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Do NOT restrict to 'address' only — also allow establishment/geocode
    // so users can search by business name (e.g. "Padaria do João").
    // Omitting the `types` param returns all result types from Google.
    const params = new URLSearchParams({
      input: input.trim(),
      key: apiKey,
      language: 'pt-BR',
      components: 'country:br',
      ...(sessiontoken ? { sessiontoken } : {}),
    });

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`;
    const response = await fetch(url);
    const data = await response.json();

    console.log(`Places autocomplete for "${input}" → status: ${data.status}, count: ${data.predictions?.length ?? 0}`);

    return new Response(JSON.stringify({
      predictions: data.predictions ?? [],
      status: data.status,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('maps-places error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
