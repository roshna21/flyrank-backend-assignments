import { mkdir, writeFile } from "node:fs/promises";
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
    // Stretch: at most 2 reports are built at once; the rest wait in line.
    concurrency: { limit: 2 },
    // Runs once every attempt has failed, so clients polling see "failed" instead of "pending" forever.
    onFailure: async ({ event, error }) => {
      const { id, topic } = event.data.event.data;
      reports.set(id, { ...reports.get(id), id, topic, status: "failed", error: error.message });
    },
  },
  async ({ event, step }) => {
    const { id, topic } = event.data;

    // A quick first step. Once it finishes, Inngest saves its result and never re-runs it,
    // even if the API restarts during the sleep below (see "restart experiment" in the README).
    const facts = await step.run("gather-facts", () => {
      console.log(`gather-facts ran for ${id}`);
      return { sources: 3, gatheredAt: new Date().toISOString() };
    });

    // Stand-in for a real slow task (an AI call, a big export).
    await step.sleep("do-the-slow-work", "8s");

    const result = await step.run("build-report", async () => {
      // Stretch, idempotency: if this report was already built (same event delivered twice), do nothing.
      const existing = reports.get(id);
      if (existing?.status === "done") {
        console.log(`build-report skipped for ${id}: already done`);
        return existing.result;
      }

      if (topic === "fail") throw new Error("The report oven is broken!");

      // 2 s of "rendering". Unlike step.sleep, this keeps a concurrency slot busy,
      // so the limit of 2 is visible when several reports are built at once.
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const result = {
        title: `The ${topic} report`,
        summary: `Everything worth knowing about ${topic}, from ${facts.sources} sources, made in the background.`,
        generatedAt: new Date().toISOString(),
      };
      reports.set(id, { ...reports.get(id), id, topic, status: "done", result, finishedAt: Date.now() });
      return result;
    });

    // Extra: "email" the result. Writing outbox/<id>.txt stands in for sending mail from a job.
    await step.run("send-email", async () => {
      await mkdir("outbox", { recursive: true });
      // "wx" fails if the file exists, so a duplicate run never sends the email twice.
      try {
        await writeFile(`outbox/${id}.txt`, `Subject: ${result.title}\n\n${result.summary}\n`, { flag: "wx" });
      } catch (err) {
        if (err.code !== "EEXIST") throw err;
      }
    });

    return result;
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

// Extra: cron's most common real job is taking out the trash.
// Every 5 minutes, delete done reports that finished more than 10 minutes ago.
const cleanup = inngest.createFunction(
  { id: "cleanup-old-reports", triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) => {
    return await step.run("delete-old-reports", () => {
      const cutoff = Date.now() - 10 * 60 * 1000;
      let deleted = 0;
      for (const [id, report] of reports) {
        if (report.status === "done" && report.finishedAt < cutoff) {
          reports.delete(id);
          deleted += 1;
        }
      }
      console.log(`cleanup: deleted ${deleted} old report(s)`);
      return { deleted };
    });
  },
);

export const functions = [sayHello, makeReport, heartbeat, cleanup];
