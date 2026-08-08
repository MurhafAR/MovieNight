const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

const MODEL = "gemini-3.5-flash";
interface HistoryEntry {
    role: "user" | "model";
    text: string;
}

export async function generateAiResponse(query: string, history: HistoryEntry[] = []): Promise<string | null> {
    if (!API_KEY || API_KEY.length < 10) {
        console.error("Gemini API key is missing or invalid!");
        return null;
    }

    const contents = [
        ...history.map(h => ({
            role: h.role,
            parts: [{ text: h.text }],
        })),
        {
            role: "user",
            parts: [{ text: query }],
        },
    ];

    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    system_instruction: {
                        parts: [{
                            text: `You are a versatile AI assistant for a collaborative platform.
                             When users ask about movies or TV shows,
                            respond as a passionate film/ TV expert — recomcmend similar titles,
                             discuss themes, directors, acting, cinematography, and trivia.When users ask about study topics or academic subjects,
                              respond as a knowledgeable teacher — explain concepts clearly, provide examples, and encourage further learning.
                              For any other topic, be helpful, friendly, and concise.Keep responses under 500 tokens and make them engaging.`
                        }]
                    },
                    contents,
                    generationConfig: {
                        maxOutputTokens: 500,
                        temperature: 0.7,
                    },
                }),
            }
        );

        if (!res.ok) {
            const errText = await res.text();
            console.error("Gemini API error:", res.status, errText);
            return null;
        }

        const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
    } catch (err) {
        console.error("Failed to call Gemini API:", err);
        return null;
    }
}