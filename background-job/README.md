# Your first background job

FlyRank Internship · Backend Track · W4 · A7

Run it in two terminals:

```bash
npm install
npm run dev        # terminal 1: the API on http://localhost:3000
npm run inngest    # terminal 2: the Inngest Dev Server + dashboard on http://localhost:8288
```

Check it: `curl -i http://localhost:3000/health`

Order a report, then poll its status:

```bash
curl -i -X POST http://localhost:3000/reports -H "Content-Type: application/json" -d '{"topic":"cats"}'
curl http://localhost:3000/reports/<id>
```

## Retries vs. validation

A missing topic is a wrong *input*, so it is rejected at the door with a 400 and no job is created; a broken oven is a wrong *moment*, so the job is retried with backoff because trying again later might work.

## Cron

The `heartbeat` function runs on `* * * * *` (every minute) and logs a line like `heartbeat: 0 pending, 1 done, 1 failed`.

- To run it every day at 08:00 the expression would be `0 8 * * *`.
- To run it every Sunday at 22:00 the expression would be `0 22 * * 0`.
