import { Inngest } from "inngest";

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

export const functions = [sayHello];
