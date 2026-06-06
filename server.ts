import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API route to generate logic
  app.post("/api/generate-logic", async (req, res) => {
    try {
      const { prompt, elementType } = req.body;
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        config: { systemInstruction: "You are an expert at Minecraft Bedrock UI JSON programming." },
        contents: `You are assisting a developer working on a custom GUI in Minecraft Bedrock edition. 
        They selected a "${elementType}" UI element and provided this instruction: "${prompt}".
        Generate the raw JSON object snippet that implements this logic for Bedrock (e.g., button_mappings for a button, or bindings for a label).
        Return ONLY valid JSON. Omit all markdown formatting like \`\`\`json. Return just the JSON object string.`,
      });
      
      let text = response.text || "{}";
      text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
      
      res.json({ result: text });
    } catch (e: any) {
      console.error("AI Generation Error:", e);
      res.status(500).json({ error: "Failed to generate logic via AI." });
    }
  });

  // API route to generate triggers
  app.post("/api/generate-trigger", async (req, res) => {
    try {
      const { prompt } = req.body;
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        config: { systemInstruction: "You are an expert at Minecraft Bedrock Script API programming." },
        contents: `Write a Minecraft Bedrock Script API code snippet that listens to an event or condition described by this prompt: "${prompt}". 
        When the condition is met, it MUST run \`system.runTimeout(() => { showCustomUI(targetPlayer); }, 5);\`.
        Replace \`targetPlayer\` with the appropriate player object from the event.
        Return ONLY the raw JavaScript code block. Omit all markdown formatting like \`\`\`javascript. Return just the code.`,
      });
      
      let text = response.text || "";
      text = text.replace(/```javascript/gi, "").replace(/```js/gi, "").replace(/```/g, "").trim();
      
      res.json({ result: text });
    } catch (e: any) {
      console.error("AI Trigger Generation Error:", e);
      res.status(500).json({ error: "Failed to generate trigger via AI." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
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
