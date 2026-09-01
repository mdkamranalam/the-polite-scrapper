import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROMPT_FILE = path.join(__dirname, "prompts", "enrich.md");
const QUARANTINE_FILE = path.join(__dirname, "..", "logs", "ai-quarantine.jsonl");

const app = express();
app.use(express.json());

// Zod schemas
const InputSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().min(1).max(5000),
  price: z.number().optional(),
});

const OutputSchema = z.object({
  category: z.enum([
    "fiction",
    "non_fiction",
    "sci_fi_fantasy",
    "mystery_thriller",
    "history_biography",
    "romance",
    "children",
    "other",
  ]),
  target_audience: z.enum(["general", "adult", "young_adult", "children"]),
  summary: z.string().max(200),
  confidence: z.number().min(0).max(1),
  quality_flags: z.array(z.string()),
});

// OpenAI client
// Note: AI version forgets to override default SDK 10-minute timeout and default retries!
const client = new OpenAI({
  baseURL: process.env.LLM_BASE_URL,
  apiKey: process.env.LLM_API_KEY,
});

app.post("/enrich", async (req, res) => {
  // Input validation
  const validation = InputSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: "Invalid input", details: validation.error.issues });
  }

  // Kill switch check
  if (process.env.LLM_ENABLED === "false") {
    return res.json({
      category: "other",
      target_audience: "general",
      summary: "LLM Disabled fallback",
      confidence: 0,
      quality_flags: ["fallback"],
    });
  }

  // Stub mode
  if (process.env.LLM_STUB === "1") {
    return res.json({
      category: "fiction",
      target_audience: "general",
      summary: "Stub summary",
      confidence: 0.9,
      quality_flags: ["clean"],
    });
  }

  const startTime = Date.now();
  let systemPrompt = "";
  try {
    systemPrompt = await fs.readFile(PROMPT_FILE, "utf-8");
  } catch (e) {
    systemPrompt = "Classify book into JSON.";
  }

  let rawOutput = "";
  try {
    const completion = await client.chat.completions.create({
      model: process.env.LLM_MODEL || "openrouter/free",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(validation.data) },
      ],
    });

    rawOutput = completion.choices[0]?.message?.content || "";
    let parsed;
    try {
      parsed = JSON.parse(rawOutput.replace(/```json/g, "").replace(/```/g, "").trim());
    } catch (e) {
      // Repair retry
      const repair = await client.chat.completions.create({
        model: process.env.LLM_MODEL || "openrouter/free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(validation.data) },
          { role: "assistant", content: rawOutput },
          { role: "user", content: `Failed to parse JSON: ${e.message}. Fix it.` },
        ],
      });
      parsed = JSON.parse(repair.choices[0]?.message?.content.replace(/```json/g, "").replace(/```/g, "").trim());
    }

    const outputVal = OutputSchema.safeParse(parsed);
    if (outputVal.success) {
      // Cost log
      console.log(
        JSON.stringify({
          duration: Date.now() - startTime,
          tokens: completion.usage,
          success: true,
        })
      );
      return res.json(outputVal.data);
    }

    // Unrepairable -> log to quarantine
    await fs.appendFile(
      QUARANTINE_FILE,
      JSON.stringify({ input: validation.data, output: rawOutput, error: outputVal.error }) + "\n"
    );
    return res.status(422).json({ error: "Validation failed" });
  } catch (err) {
    // If 401 error or other error, generic catch
    return res.status(500).json({ error: err.message });
  }
});

export default app;
