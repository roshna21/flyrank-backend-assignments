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
