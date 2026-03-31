// src/services/aiDoctorService.ts

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

// Headers required for OpenRouter free models
const referer = window.location.hostname === 'localhost' 
  ? 'http://localhost:5173' 
  : 'https://myhealth79.web.app/';

export const getAiDoctorResponse = async (
  userMessage: string, 
  userName: string,
  cleanHealthSummary: any, 
  cohortStats: any 
) => {
  const systemPrompt = `
    You are an AI medical and fitness assistant for the myHealth app. You are talking to ${userName}.
    
    CRITICAL INSTRUCTION: 
    You have access to the user's LIVE vitals, EXERCISE records, and group comparison stats below. 
    1. Analyze the "Recent Health & Exercise Data" and "Cohort Comparison" BEFORE responding. 
    2. The standard metrics (e.g., "[Vital] Heart Rate": 110) represent their MOST CURRENT reading.
    3. You ALSO have access to historical samples in array format (e.g., "[Vital History] Heart Rate": [72, 74, 75, 71, 73]). Use these historical arrays to answer questions about trends, previous values, or patterns over time.
    4. If a current value or trend is present in the data, do NOT ask the user to "check" it. Instead, comment on the data you see.
    5. Be prepared to offer specific, contextualized exercise or fitness advice if relevant to their active alerts, vitals, or questions.
    6. Use the Z-Scores to determine how abnormal the data is compared to their cohort (Z > 2 or < -2 is significant).
    
    PATIENT CONTEXT:
    Active Alerts: ${JSON.stringify(cleanHealthSummary['Active Alerts'] || 'None')}
    Recent Health, Exercise, and History Data: ${JSON.stringify(cleanHealthSummary || 'No data')}
    
    COHORT STATS (Z-Scores & Percentiles):
    ${JSON.stringify(cohortStats, null, 2)}
    
    INSTRUCTIONS:
    - If you see a SIRS or critical alert, reference the specific vitals (HR, Temp, RR) provided in the data that triggered it.
    - If the user asks about how their metrics are trending, compare their current reading to their History arrays.
    - Incorporate fitness/exercise recommendations appropriately based on their most recent exercise data and trends.
    - Be empathetic but clinical. If data is entirely missing, only then ask for it.
    - Keep response under 60 words.
  `;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": referer,
        "X-Title": "myHealth App",
      },
      body: JSON.stringify({
        // Using a specific free model or "openrouter/free" to avoid 402 errors
        model: "openrouter/free", 
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ]
      })
    });

    const data = await response.json();

    // Safety Check: Ensure the response is OK and choices exist before accessing [0]
    if (!response.ok || !data.choices || data.choices.length === 0) {
      console.error("OpenRouter API Error:", data.error || "No choices returned");
      return null;
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error("Error fetching AI response:", error);
    return null;
  }
};