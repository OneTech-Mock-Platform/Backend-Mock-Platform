const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite';

export async function callGeminiJSON(prompt: string): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY manquant dans les variables d'environnement.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    },
  );

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Appel Gemini échoué (${response.status}) : ${errBody}`);
  }

  const data: any = await response.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Réponse Gemini non-JSON : ${text.slice(0, 300)}`);
  }
}
