/**
 * Job lifecycle loop test — end-to-end smoke of the locksmith job flow.
 *
 * Walks a real job through every status the locksmith app drives, plus the
 * quote submission, hitting the LIVE API exactly like the mobile app does, and
 * asserts each stage succeeds. This is the "start to end" loop test: if every
 * step is ✅ the server side of a job can be completed.
 *
 * It deliberately mirrors the MOBILE payloads (e.g. the quote body omits
 * `total`, which is what exposed the 400 bug) so a regression there fails here.
 *
 * USAGE (run against production with an admin session):
 *   1. Log into https://www.locksafe.uk/admin in a browser.
 *   2. Copy your `auth_token` cookie value.
 *   3. JOB_ID=<existing test job id> AUTH=<auth_token> \
 *        node scripts/job-lifecycle-loop-test.mjs
 *
 * Or set BASE_URL to a local/preview deploy. It NEVER hard-deletes anything;
 * it only advances statuses and submits a quote, so run it on a TEST job.
 *
 * Exit code 0 = all green; 1 = at least one step failed.
 */

const BASE_URL = process.env.BASE_URL || "https://www.locksafe.uk";
const JOB_ID = process.env.JOB_ID;
const AUTH = process.env.AUTH || ""; // value of the auth_token cookie

if (!JOB_ID) {
  console.error("✗ Set JOB_ID=<job id> (a test job). Optionally BASE_URL + AUTH=<auth_token cookie>.");
  process.exit(1);
}

const headers = {
  "content-type": "application/json",
  ...(AUTH ? { cookie: `auth_token=${AUTH}` } : {}),
};

let failures = 0;
const log = (ok, step, detail) => {
  console.log(`${ok ? "✅" : "❌"} ${step}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
};

async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-json */ }
  return { status: res.status, json };
}

async function setStatus(status, extra = {}) {
  const r = await api("PATCH", `/api/jobs/${JOB_ID}/status`, { status, ...extra });
  log(r.status === 200 && r.json?.success !== false, `status → ${status}`, `HTTP ${r.status}`);
  return r;
}

async function run() {
  console.log(`\n▶ Job lifecycle loop test against ${BASE_URL} (job ${JOB_ID})\n`);

  // 0. Read the job so we know its starting state + that the customer has a phone
  const job = await api("GET", `/api/jobs/${JOB_ID}`);
  log(job.status === 200, "fetch job", `HTTP ${job.status}`);
  const customerPhone = job.json?.job?.customer?.phone || job.json?.customer?.phone;
  log(!!customerPhone, "customer has a phone (needed for SMS)", customerPhone ? "present" : "MISSING — en-route SMS will be skipped");

  // 1. Walk the status machine the way the locksmith app does.
  await setStatus("EN_ROUTE", { gpsData: { lat: 51.43, lng: -0.55 } }); // fires customer "on the way" SMS
  await setStatus("ARRIVED");
  await setStatus("DIAGNOSING");

  // 2. Submit a quote with the EXACT mobile payload shape (no `total` sent).
  //    This is the step that used to 400. It must now compute totals server-side.
  const quote = await api("POST", `/api/jobs/${JOB_ID}/quote`, {
    lockType: "mortice",
    defect: "Loop-test: key snapped in lock",
    difficulty: "medium",
    parts: [{ name: "Replacement cylinder", quantity: 1, unitPrice: 25 }],
    labourCost: 65,
    labourTime: 30,
    gps: { lat: 51.43, lng: -0.55 },
  });
  log(
    quote.status === 200 && quote.json?.success,
    "submit quote (mobile shape, no total)",
    `HTTP ${quote.status}${quote.json?.quote?.total != null ? `, total £${quote.json.quote.total}` : ""}`,
  );

  // 3. Customer accepts the quote.
  const accept = await api("PATCH", `/api/jobs/${JOB_ID}/quote`, { action: "accept" });
  log(accept.status === 200 && accept.json?.success, "accept quote", `HTTP ${accept.status}`);

  // 4. Finish the job.
  await setStatus("IN_PROGRESS");
  await setStatus("COMPLETED");

  console.log(`\n${failures === 0 ? "✅ ALL GREEN — job can be completed start to end." : `❌ ${failures} step(s) failed.`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((e) => { console.error("✗ loop test crashed:", e); process.exit(1); });
