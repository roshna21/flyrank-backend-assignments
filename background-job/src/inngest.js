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
  { id: "make-report", triggers: [{ event: "report/requested" }] },
  async ({ event, step }) => {
    const { id, topic } = event.data;

    // Stand-in for a real slow task (an AI call, a big export).
    await step.sleep("do-the-slow-work", "8s");

    return await step.run("build-report", () => {
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

export const functions = [sayHello, makeReport];
