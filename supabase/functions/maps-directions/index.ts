import { corsHeaders } from '../_shared/cors.ts';

// Google Directions API — server-side (returns route polyline + distance)
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { origin, destination } = await req.json();
    // origin/destination: { lat: number; lng: number } or address string

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const originStr = typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`;
    const destStr = typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`;

    const params = new URLSearchParams({
      origin: originStr,
      destination: destStr,
      key: apiKey,
      language: 'pt-BR',
      mode: 'driving',
      units: 'metric',
      region: 'br',
    });

    const url = `https://maps.googleapis.com/maps/api/directions/json?${params}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.routes?.length) {
      console.warn(`Directions failed: status=${data.status}`);
      return new Response(JSON.stringify({ error: data.status ?? 'No route found', routes: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const route = data.routes[0];
    const legs = route.legs ?? [];
    let totalMeters = 0;
    let totalSeconds = 0;
    for (const leg of legs) {
      totalMeters += leg.distance?.value ?? 0;
      totalSeconds += leg.duration?.value ?? 0;
    }
    const leg0 = legs[0];
    const distanceText =
      totalMeters >= 1000
        ? `${(totalMeters / 1000).toFixed(1).replace('.', ',')} km`
        : `${Math.round(totalMeters)} m`;
    const durationText = leg0?.duration?.text ?? '';

    console.log(`Directions: ${originStr} → ${destStr} = ${distanceText}, ${durationText} (${legs.length} trecho(s))`);

    return new Response(JSON.stringify({
      polyline: route.overview_polyline?.points ?? '',
      distance: { text: distanceText, value: totalMeters },
      duration: {
        text: durationText,
        value: totalSeconds || (leg0?.duration?.value ?? 0),
      },
      start_location: leg0?.start_location,
      end_location: legs[legs.length - 1]?.end_location ?? leg0?.end_location,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('maps-directions error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
