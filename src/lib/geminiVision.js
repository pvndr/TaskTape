const GEMINI_KEY_STORAGE = 'tasktape_gemini_api_key';

export const VALID_TAPE_COLORS = [
  'tape-cream',
  'tape-red',
  'tape-mustard',
  'tape-teal',
  'tape-sage'
];

/**
 * Retrieves the Gemini API key from localStorage or Vite environment variable.
 */
export function getGeminiApiKey() {
  try {
    const local = localStorage.getItem(GEMINI_KEY_STORAGE);
    if (local && local.trim()) return local.trim();
  } catch {
    // localStorage might be unavailable or restricted
  }

  const envKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY) ||
    '';

  return envKey.trim();
}

/**
 * Stores or clears the Gemini API key in localStorage.
 */
export function setGeminiApiKey(key) {
  try {
    if (!key || !key.trim()) {
      localStorage.removeItem(GEMINI_KEY_STORAGE);
    } else {
      localStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
    }
  } catch (err) {
    console.warn('Failed to save Gemini API key in localStorage:', err);
  }
}

/**
 * Sends a compressed base64 image to be deciphered into tasks.
 * First tries the secure serverless backend proxy (/api/scan-notepad) where the API key
 * is stored securely on the server with zero client exposure.
 * Falls back to direct Gemini 1.5 Flash Vision API call if running standalone/locally with an explicit key.
 */
export async function extractTasksFromNotepadImage(base64Data, mimeType = 'image/jpeg', apiKeyOverride = null) {
  // 1. Try secure serverless proxy first (no client API key required)
  const proxyEndpoints = ['/.netlify/functions/scan-notepad', '/api/scan-notepad'];

  for (const endpoint of proxyEndpoints) {
    try {
      const proxyRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image: base64Data, mimeType })
      });

      const contentType = proxyRes.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await proxyRes.json();
        if (proxyRes.ok && Array.isArray(data?.tasks)) {
          return data.tasks;
        }
        if (data?.error && !data.error.includes('GEMINI_API_KEY')) {
          throw new Error(data.error);
        }
      }
    } catch (proxyErr) {
      if (proxyErr?.message && !proxyErr.message.includes('fetch')) {
        throw proxyErr;
      }
    }
  }

  // 2. Direct client fallback (requires an API key in localStorage or .env)
  const apiKey = (apiKeyOverride || getGeminiApiKey()).trim();

  if (!apiKey) {
    const err = new Error(
      'Notepad scanning is ready. If deployed on Netlify, add GEMINI_API_KEY in your Netlify dashboard. For local development, paste your key in Profile.'
    );
    err.code = 'MISSING_API_KEY';
    throw err;
  }

  const promptText = `You are a helpful handwriting reader for a masking-tape to-do list app.
Carefully examine this photo of a handwritten spiral pad, notebook, or paper sheet, and extract all active to-do checklist items.

Rules:
1. Ignore items that are crossed out with a line, scribble, or already checked off with a checkmark.
2. Ignore headings, dates, page numbers, margins, or random doodles.
3. If an item wraps onto multiple lines or includes sub-bullets, combine it into one clean, concise task description.
4. Expand common handwriting shortcuts when obvious (e.g. "w/" -> "with", "appt" -> "appointment").
5. Assign each task one of these 5 tape colors to create a cozy, balanced board:
   - "tape-cream" (neutral/default)
   - "tape-red" (urgent or high priority)
   - "tape-mustard" (creative or errands)
   - "tape-teal" (work or focus)
   - "tape-sage" (wellness, personal, or habits)

Return a strict JSON array where each object has "title" (string) and "color" (one of the 5 tape colors).`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data
            }
          },
          {
            text: promptText
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            color: {
              type: 'STRING',
              enum: VALID_TAPE_COLORS
            }
          },
          required: ['title', 'color']
        }
      }
    }
  };

  const candidateModels = [
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash'
  ];

  let lastError = null;

  for (const modelName of candidateModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const message = errData?.error?.message || `API error (${response.status}): ${response.statusText}`;

        // If this model is deprecated or not found for this API version, try the next model candidate
        if (response.status === 404 || message.includes('not found') || message.includes('not supported')) {
          lastError = new Error(message);
          continue;
        }

        const err = new Error(message);
        err.status = response.status;
        if (response.status === 400 && message.toLowerCase().includes('api_key')) {
          err.code = 'INVALID_API_KEY';
        }
        throw err;
      }

      const data = await response.json();
      const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textOutput) {
        return [];
      }

      let parsed = [];
      try {
        parsed = JSON.parse(textOutput);
      } catch (err) {
        console.warn('Failed to parse Gemini JSON output directly, attempting fallback clean:', err);
        const cleaned = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      }

      if (!Array.isArray(parsed)) {
        return [];
      }

      // Format and validate items with random UUID and color fallback
      return parsed
        .map((item, index) => {
          const cleanTitle = (item?.title || '').trim();
          if (!cleanTitle) return null;

          const color = VALID_TAPE_COLORS.includes(item?.color)
            ? item.color
            : VALID_TAPE_COLORS[index % VALID_TAPE_COLORS.length];

          return {
            id: crypto.randomUUID(),
            title: cleanTitle,
            color,
            selected: true
          };
        })
        .filter(Boolean);
    } catch (err) {
      if (err.code === 'INVALID_API_KEY') {
        throw err;
      }
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini model candidates failed');
}
