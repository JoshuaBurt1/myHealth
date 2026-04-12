import { GoogleGenerativeAI } from "@google/generative-ai";

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// OpenRouter headers
const referer = window.location.hostname === 'localhost' 
  ? 'http://localhost:5173' 
  : 'https://myhealth79.web.app/';

export const getAiDoctorResponse = async (
  userMessage: string, 
  userName: string,
  cleanHealthSummary: any, 
  cohortStats: any 
) => {
  const activeAlertsStr = cleanHealthSummary['Active Alerts Summary'] || 'None';

  const systemPrompt = `
    You are an AI medical and fitness assistant for the myHealth app. You are talking to ${userName}.
    
    PRIMARY INSTRUCTION:
    This is the start of the clinical encounter. You MUST acknowledge the following active alerts and the specific times they occurred in your opening sentence:
    ALERTS: ${activeAlertsStr}

    CRITICAL ANALYSIS: 
    1. Analyze the "Recent Health & Exercise Data" and "Cohort Comparison" before responding. 
    2. The standard metrics (e.g., "Vital Heart Rate": 110) represent their most current reading.
    3. Use historical arrays (e.g., "Vital History") to determine if this is a new spike or a persistent trend.
    4. Use Z-Scores to prioritize the most abnormal metrics (Z > 2 or < -2 is significant).
    5. If a current value or trend is present in the data, do NOT ask the user to "check" it. Comment on it directly.
    
    PATIENT CONTEXT:
    Active Alerts Detail: ${JSON.stringify(cleanHealthSummary['Active Alerts'] || 'None')}
    Recent Health, Exercise, and History Data: ${JSON.stringify(cleanHealthSummary || 'No data')}
    
    COHORT STATS (Z-Scores & Percentiles):
    ${JSON.stringify(cohortStats, null, 2)}
    
    RESPONSE RULES:
    - Your first sentence must state the active alerts and their onset times.
    - If you see a SIRS or critical alert, reference the specific vitals (HR, Temp, RR) that triggered it.
    - Incorporate fitness/exercise recommendations appropriately based on recent data and trends.
    - Keep the total response under 60 words.
    - Be empathetic but clinical.
  `;
  
  // PRIMARY API: Google Gemini SDK
  const fetchGemini = async () => {
    if (!GEMINI_API_KEY) return null;

    try {
      const modelId = "gemini-3-flash-preview"; 
      console.log(`Attempting response from Primary: ${modelId}...`);

      const geminiModel = genAI.getGenerativeModel({ 
        model: modelId,
        systemInstruction: systemPrompt,
      });

      const result = await geminiModel.generateContent(userMessage);
      const response = await result.response;
      const text = response.text();
      
      if (!text) return null;

      console.log(`Model responding: ${modelId}`);
      return text;
    } catch (error: any) {
      console.warn(`Gemini SDK Error (Status: ${error?.status || 'Unknown'}):`, error.message);
      return null;
    }
  };

  // SECONDARY/FALLBACK API: OpenRouter API
  const fetchOpenRouter = async () => {
    if (!OPENROUTER_API_KEY) {
      console.warn("OpenRouter API Key missing.");
      return null;
    }

    const modelId = "openrouter/free";
    console.log(`Attempting response from Secondary: ${modelId}...`);

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
          model: modelId, 
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
          ]
        })
      });

      const data = await response.json();

      if (!response.ok || !data.choices || data.choices.length === 0) {
        console.error("OpenRouter API Error:", data.error || "No choices returned");
        return null;
      }

      const text = data.choices[0].message.content;
      console.log(`Model responding: ${modelId} (OpenRouter)`);
      return text;

    } catch (error) {
      console.error("Error fetching OpenRouter response:", error);
      return null;
    }
  };

  // Execution Strategy
  /*
  let aiResponse = await fetchGemini();

  if (!aiResponse) {
    console.log("Gemini failed. Switching to OpenRouter...");
    aiResponse = await fetchOpenRouter();
  }*/

  // Execution Strategy
  let aiResponse = await fetchOpenRouter();

  if (!aiResponse) {
    console.log("OpenRouter failed. Switching to Gemini...");
    aiResponse = await fetchGemini();
  }
 
  return aiResponse || "The medical systems are currently offline. Please try again later.";
};