import { randomUUID } from "node:crypto";
import express from "express";
import { serve } from "inngest/express";
import { functions, inngest } from "./inngest.js";
import { reports } from "./reports.js";

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// The fast door: save the order, hand the work to Inngest, answer 202 right away.
app.post("/reports", async (req, res) => {
  const { topic } = req.body ?? {};
  // Bad input is rejected at the door: 400, and no job is ever created.
  if (typeof topic !== "string" || topic.trim() === "") {
    return res.status(400).json({ error: "\"topic\" is required and must be a non-empty string" });
  }

  const id = randomUUID();
  reports.set(id, { id, topic, status: "pending" });

  try {
    await inngest.send({ name: "report/requested", data: { id, topic } });
  } catch (err) {
    reports.set(id, { id, topic, status: "failed", error: "Could not reach Inngest" });
    console.error("inngest.send failed:", err.message);
    return res.status(503).json({ id, status: "failed", error: "Job queue unavailable, try again later" });
  }

  res.status(202).json({ id, status: "pending" });
});

// The status endpoint: clients poll this until the report is done.
app.get("/reports/:id", (req, res) => {
  const report = reports.get(req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found" });
  res.json(report);
});

// Inngest calls this path to run our functions.
app.use("/api/inngest", serve({ client: inngest, functions }));

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
