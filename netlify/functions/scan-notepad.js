const VALID_TAPE_COLORS = [
  'tape-cream',
  'tape-red',
  'tape-mustard',
  'tape-teal',
  'tape-sage'
];

/**
 * Netlify Serverless Function: Secure proxy for Gemini Vision handwriting extraction.
 * Keeps the master GEMINI_API_KEY hidden on the server so frontend users never see it.
 */
export async function handler(event) {
  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        Allow: 'POST'
      },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  // Get private server API key
  const apiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'GEMINI_API_KEY is not configured on the server. Please add it to Netlify Environment Variables.'
      })
    };
  }

  // Parse payload
  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON request body' })
    };
  }

  const { image, mimeType = 'image/jpeg' } = payload;
  if (!image) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing image data in request' })
    };
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
              data: image
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

  let lastErrorMessage = '';

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
        const message = errData?.error?.message || `Gemini API returned status ${response.status}`;

        // If this model is deprecated or not found for this API version, try the next model candidate
        if (response.status === 404 || message.includes('not found') || message.includes('not supported')) {
          lastErrorMessage = message;
          continue;
        }

        return {
          statusCode: response.status >= 500 ? 502 : response.status,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: message })
        };
      }

      const data = await response.json();
      const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textOutput) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tasks: [] })
        };
      }

      let parsed = [];
      try {
        parsed = JSON.parse(textOutput);
      } catch {
        const cleaned = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      }

      if (!Array.isArray(parsed)) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tasks: [] })
        };
      }

      const tasks = parsed
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

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        },
        body: JSON.stringify({ tasks })
      };
    } catch (err) {
      lastErrorMessage = err?.message || 'Error calling model candidate';
    }
  }

  return {
    statusCode: 502,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: lastErrorMessage || 'All Gemini model candidates failed' })
  };
  } catch (err) {
    console.error('Serverless function error calling Gemini:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err?.message || 'Internal Server Error' })
    };
  }
}
