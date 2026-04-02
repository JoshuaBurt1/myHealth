import { GoogleGenerativeAI } from "@google/generative-ai";

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Initialize Gemini SDK once
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

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
    1. Analyze the "Recent Health Data" below to explain WHY these alerts triggered (e.g., if there's a tachycardia alert, point to the HR of 110).
    2. Use historical arrays (e.g., "[Vital History]") to determine if this is a new spike or a persistent trend.
    3. Use Z-Scores to prioritize the most abnormal metrics.
    
    PATIENT CONTEXT:
    Recent Health, Exercise, and History Data: ${JSON.stringify(cleanHealthSummary || 'No data')}
    
    COHORT STATS:
    ${JSON.stringify(cohortStats, null, 2)}
    
    RESPONSE RULES:
    - Your first sentence MUST state the active alerts and their onset times.
    - Keep the total response under 60 words.
    - Be empathetic but clinical.
    - After stating the alerts, ask how the user is feeling or provide one immediate health/fitness insight based on the data.
  `;
  
  // --- PRIMARY: Google Gemini SDK ---
  const fetchGemini = async () => {
    if (!GEMINI_API_KEY) {
      console.warn("Gemini API Key missing.");
      return null;
    }

    try {
      // Switch to stable 'gemini-3-flash' to avoid 503 preview overloads
      const modelId = "gemini-3-flash-preview"; 
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
      // Log the specific error for debugging
      console.warn(`Gemini SDK Error (Status: ${error?.status || 'Unknown'}):`, error.message);
      return null;
    }
  };

  // --- FALLBACK: OpenRouter API ---
  const fetchOpenRouter = async () => {
    if (!OPENROUTER_API_KEY) {
      console.warn("OpenRouter API Key missing.");
      return null;
    }

    try {
      const modelId = "openrouter/free";
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

      if (!response.ok) {
        console.error(`OpenRouter Error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || null;
      
      if (text) {
        console.log(`Model responding: ${modelId} (OpenRouter)`);
      }

      return text;
    } catch (error) {
      console.error("OpenRouter Network/API Error:", error);
      return null;
    }
  };

  // --- Execution Strategy ---
  let aiResponse = await fetchGemini();

  if (!aiResponse) {
    console.log("Gemini failed. Switching to OpenRouter...");
    aiResponse = await fetchOpenRouter();
  }

  return aiResponse || "The medical systems are currently offline. Please try again later.";
};