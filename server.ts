import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

let ai: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please add it via the Settings > Secrets panel in Google AI Studio.");
    }
    ai = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return ai;
}

async function startServer() {
  app.use(express.json());

  // API Health Check
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      hasApiKey: !!process.env.GEMINI_API_KEY,
    });
  });

  // Check-in Endpoint
  app.post("/api/checkin", async (req, res) => {
    try {
      const { name, goal, text, recentEntries } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Check-in text is required." });
      }

      const client = getGeminiClient();

      const historyText = recentEntries && Array.isArray(recentEntries) && recentEntries.length > 0
        ? recentEntries.slice(-3).map((e: any) => `- Entry: "${e.text}" (Mood: ${e.mood}/10, AI Response: "${e.aiResponse}")`).join("\n")
        : "No previous entries.";

      const systemInstruction = `You are KelpAI, a calm, warm AI companion for a college student named ${name || "Student"} whose current career-related goal is: "${goal || "General Career Clarity"}".

Your job for every check-in:
1. Read the student's entry for tone, stress, imposter syndrome, and any comparison-driven anxiety (e.g. feeling behind because others are getting internships).
2. Respond in 2-4 sentences: validate their feelings briefly and warmly, gently reframe using CBT-style thinking (separating facts from anxious/exaggerated interpretations), and ground them in their own unique values, strengths, or incremental progress. Never compare them to peers.
3. Always end with exactly ONE small, highly concrete, actionable next step they could easily take today (e.g., read a single paragraph, draft one email sentence, take 3 slow breaths, or look up one company).
4. Never diagnose, never use clinical labels, never be preachy, and do not be overly long.
5. If the entry suggests a serious crisis (self-harm, total hopelessness about living), gently and clearly encourage them to connect with a professional counselor or reach out to a crisis line right away, and keep the response short, warm, and deeply caring.

Recent check-in history for context (do not repeat verbatim):
${historyText}`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: text,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              mood_score: {
                type: Type.INTEGER,
                description: "An integer from 1 to 10. 10 = extremely calm and confident, 1 = extremely distressed or overwhelmed."
              },
              response: {
                type: Type.STRING,
                description: "A comforting, validating 2-4 sentence response ending in one small actionable next step."
              }
            },
            required: ["mood_score", "response"]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("No response returned from the Gemini model.");
      }

      const parsed = JSON.parse(responseText.trim());
      res.json(parsed);

    } catch (err: any) {
      console.error("Error in /api/checkin:", err);
      res.status(500).json({ error: err.message || "An error occurred while processing your check-in." });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
