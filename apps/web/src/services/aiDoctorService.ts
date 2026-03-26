// src/services/aiDoctorService.ts

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

// Headers required for OpenRouter free models
const referer = window.location.hostname === 'localhost' 
  ? 'http://localhost:5173' 
  : 'https://myhealth79.web.app/';

export const getAiDoctorResponse = async (
  userMessage: string, 
  userName: string,
  userProfileData: any, 
  cohortStats: any 
) => {
  const systemPrompt = `
    You are an AI medical assistant for the myHealth app. You are talking to ${userName}.
    
    CRITICAL INSTRUCTION: 
    You have access to the user's LIVE vitals and group comparison stats below. 
    1. Analyze the "Recent Health Data" and "Cohort Comparison" BEFORE responding.
    2. If a value (e.g., Heart Rate: 110bpm) is present, do NOT ask the user to "check" it. Instead, comment on the value you see.
    3. Use the Z-Scores to determine how abnormal the data is (Z > 2 or < -2 is significant).
    
    PATIENT CONTEXT:
    Active Alerts: ${JSON.stringify(userProfileData?.activeAlerts || userProfileData?.activeAlert || 'None')}
    Recent Health Data (Actual Records): ${JSON.stringify(userProfileData || 'No data')}
    
    COHORT STATS (Z-Scores & Percentiles):
    ${JSON.stringify(cohortStats, null, 2)}
    
    INSTRUCTIONS:
    - If you see a SIRS or critical alert, reference the specific vitals (HR, Temp, RR) provided in the data that triggered it.
    - Be empathetic but clinical. If data is missing, only then ask for it.
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