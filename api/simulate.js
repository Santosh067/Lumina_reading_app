export default async function handler(req, res) {
  // ── CORS Headers ──────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // ── Validate Server-Side API Key ──────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[simulate] ANTHROPIC_API_KEY environment variable is not set.');
    return res.status(500).json({
      error: 'Server configuration error. The Anthropic API key is not configured.'
    });
  }

  // ── Parse & Validate Request Body ─────────────────────────────────────────
  const { system, messages, model } = req.body || {};

  // ── Forward to Anthropic API ──────────────────────────────────────────────
  try {
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-sonnet-20241022', // safe fallback model
        max_tokens: 1000,
        system: system,
        messages: messages || []
      })
    });

    if (!anthropicResponse.ok) {
      const errData = await anthropicResponse.json().catch(() => ({}));
      const errMsg = errData.error?.message || errData.message || `Anthropic API error (${anthropicResponse.status})`;
      console.error('[simulate] Anthropic API error:', errMsg);
      return res.status(anthropicResponse.status).json({ error: errMsg });
    }

    const data = await anthropicResponse.json();

    // Forward the Anthropic response direct to the client
    return res.status(200).json(data);

  } catch (err) {
    console.error('[simulate] Unexpected error:', err.message);
    return res.status(500).json({
      error: 'An unexpected error occurred while executing the simulation.'
    });
  }
}
