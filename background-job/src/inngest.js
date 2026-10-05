import { Inngest } from "inngest";
import { reports } from "./reports.js";

// The "assistant in the other room". In dev it talks to the local Dev Server.
export const inngest = new Inngest({
  id: "report-api",
  isDev: process.env.INNGEST_DEV !== "0",
});

// Stage 1: the smallest possible background function.
const sayHello = inngest.createFunction(
  { id: "say-hello", triggers: [{ event: "test/hello" }] },
  async ({ step }) => {
    await step.sleep("wait-a-moment", "5s");
    return "Hello from the background!";
  },
);

// Stage 2: the slow work, triggered by POST /reports.
const makeReport = inngest.createFunction(
  {
    id: "make-report",
    triggers: [{ event: "report/requested" }],
    // 1 attempt + 2 retries = 3 attempts, with growing waits (backoff) between them.
    retries: 2,
    // Runs once every attempt has failed, so clients polling see "failed" instead of "pending" forever.
    onFailure: async ({ event, error }) => {
      const { id, topic } = event.data.event.data;
      reports.set(id, { id, topic, status: "failed", error: error.message });
    },
  },
  async ({ event, step }) => {
    const { id, topic } = event.data;

    // Stand-in for a real slow task (an AI call, a big export).
    await step.sleep("do-the-slow-work", "8s");

    return await step.run("build-report", () => {
      if (topic === "fail") throw new Error("The report oven is broken!");

      const result = {
        title: `The ${topic} report`,
        summary: `Everything worth knowing about ${topic}, made in the background.`,
        generatedAt: new Date().toISOString(),
      };
      reports.set(id, { id, topic, status: "done", result });
      return result;
    });
  },
);

// Stage 4: nobody asks, the clock starts it. Every minute (testing only; a real one would run daily).
const heartbeat = inngest.createFunction(
  { id: "heartbeat", triggers: [{ cron: "* * * * *" }] },
  async ({ step }) => {
    return await step.run("count-reports", () => {
      const counts = { pending: 0, done: 0, failed: 0 };
      for (const report of reports.values()) counts[report.status] += 1;
      const line = `heartbeat: ${counts.pending} pending, ${counts.done} done, ${counts.failed} failed`;
      console.log(line);
      return line;
    });
  },
);

export const functions = [sayHello, makeReport, heartbeat];
