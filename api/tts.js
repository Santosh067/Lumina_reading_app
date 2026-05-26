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
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    console.error('[tts] SARVAM_API_KEY environment variable is not set.');
    return res.status(500).json({
      error: 'Server configuration error. The API key is not configured.'
    });
  }

  // ── Parse & Validate Request Body ─────────────────────────────────────────
  const { text, voice, pace, languageCode } = req.body || {};

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Missing or empty "text" field.' });
  }

  if (text.length > 2500) {
    return res.status(400).json({
      error: 'Text exceeds the 2,500 character limit for premium voices. Please shorten your text or use Native TTS.'
    });
  }

  // ── Forward to Sarvam AI ──────────────────────────────────────────────────
  try {
    // English 'en-IN' is unsupported by Sarvam TTS; coerce it to 'hi-IN' which
    // is fully supported and reads English text beautifully with a premium accent.
    const targetLanguage = (!languageCode || languageCode === 'en-IN') ? 'hi-IN' : languageCode;

    const sarvamResponse = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey
      },
      body: JSON.stringify({
        text: text.trim(),
        target_language_code: targetLanguage,
        model: 'bulbul:v3',
        speaker: voice || 'shubh',
        pace: pace || 1.0,
        output_audio_codec: 'mp3'
      })
    });

    if (!sarvamResponse.ok) {
      const errData = await sarvamResponse.json().catch(() => ({}));
      // Resolve [object Object] by extracting message strings from nested error objects
      const errMsg = (errData.error && typeof errData.error === 'object')
        ? (errData.error.message || JSON.stringify(errData.error))
        : (errData.error || errData.message || `Sarvam API error (${sarvamResponse.status})`);
      console.error('[tts] Sarvam API error:', errMsg);
      return res.status(sarvamResponse.status).json({ error: errMsg });
    }

    const data = await sarvamResponse.json();

    if (!data.audios || data.audios.length === 0) {
      return res.status(502).json({
        error: 'No audio was returned by the Sarvam AI API.'
      });
    }

    // Return the audio data to the client
    return res.status(200).json({ audios: data.audios });

  } catch (err) {
    console.error('[tts] Unexpected error:', err.message);
    return res.status(500).json({
      error: 'An unexpected error occurred while synthesizing speech. Please try again.'
    });
  }
}
