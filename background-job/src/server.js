import express from "express";
import { serve } from "inngest/express";
import { functions, inngest } from "./inngest.js";

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Inngest calls this path to run our functions.
app.use("/api/inngest", serve({ client: inngest, functions }));

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
