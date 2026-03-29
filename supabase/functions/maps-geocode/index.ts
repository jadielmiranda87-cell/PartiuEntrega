import { corsHeaders } from '../_shared/cors.ts';

// Google Geocoding API — converts address to lat/lng (server-side)
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { address, place_id, latlng } = await req.json();

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const params = new URLSearchParams({ key: apiKey, language: 'pt-BR' });
    if (place_id) {
      params.set('place_id', place_id);
    } else if (latlng && typeof latlng === 'string') {
      params.set('latlng', latlng.trim());
    } else if (address) {
      params.set('address', address);
    } else {
      return new Response(JSON.stringify({ error: 'address, place_id, or latlng required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?${params}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results?.length) {
      return new Response(JSON.stringify({ error: data.status ?? 'Not found', result: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = data.results[0];
    console.log(`Geocode "${address || place_id || latlng}" → ${result.geometry.location.lat},${result.geometry.location.lng}`);

    return new Response(JSON.stringify({
      result: {
        place_id: result.place_id,
        formatted_address: result.formatted_address,
        location: result.geometry.location, // { lat, lng }
        address_components: result.address_components,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('maps-geocode error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
