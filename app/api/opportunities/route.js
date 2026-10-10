import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JOB_ID = /^[0-9a-f-]{36}$/i;
const OPPORTUNITY_FIELDS = "id,title,url,source_excerpt,why_it_fits,status,found_at,decided_at";

function json(body, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function sameSecret(value, expected) {
  const actual = Buffer.from(value || "");
  const secret = Buffer.from(expected || "");
  return actual.length === secret.length && actual.length > 0 && timingSafeEqual(actual, secret);
}

function configuration() {
  const sitePassword = process.env.SITE_PASSWORD;
  const agentUrl = process.env.AGENT_URL;
  const agentSecret = process.env.AGENT_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!sitePassword || !agentUrl || !agentSecret || !supabaseUrl || !supabaseServiceKey) {
    throw new Error("The opportunities service is not configured on this server.");
  }
  return { sitePassword, agentUrl: agentUrl.replace(/\/$/, ""), agentSecret, supabaseUrl, supabaseServiceKey };
}

async function databaseRequest(config, path, options = {}) {
  const response = await fetch(config.supabaseUrl.replace(/\/$/, "") + "/rest/v1/" + path, {
    ...options,
    cache: "no-store",
    headers: {
      apikey: config.supabaseServiceKey,
      Authorization: "Bearer " + config.supabaseServiceKey,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error("Unable to load opportunities.");
  return data;
}

function readOpportunities(config, status) {
  const query = new URLSearchParams({ select: OPPORTUNITY_FIELDS, status: "eq." + status, order: "found_at.desc" });
  return databaseRequest(config, "opportunities?" + query);
}

async function agentRequest(path, options, config) {
  const response = await fetch(config.agentUrl + path, {
    ...options,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
    headers: { "content-type": "application/json", AGENT_SECRET: config.agentSecret, ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The opportunity agent could not complete that request.");
  return data;
}

export async function GET(request) {
  try {
    const config = configuration();
    const approved = await readOpportunities(config, "approved");
    if (!sameSecret(request.headers.get("x-site-password"), config.sitePassword)) return json({ opportunities: approved });
    return json({ opportunities: approved, newOpportunities: await readOpportunities(config, "new") });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load opportunities.";
    return json({ error: message }, message.includes("not configured") ? 503 : 502);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const config = configuration();
    if (!sameSecret(body.password, config.sitePassword)) return json({ error: "Incorrect site password." }, 401);

    if (body.action === "start") {
      const job = await agentRequest("/jobs", { method: "POST", body: "{}" }, config);
      return json({ id: job.id }, 202);
    }
    if (body.action === "status" || body.action === "cancel") {
      if (!JOB_ID.test(body.id || "")) return json({ error: "Invalid job id." }, 400);
      const path = body.action === "cancel" ? "/jobs/" + body.id + "/cancel" : "/jobs/" + body.id;
      return json(await agentRequest(path, { method: body.action === "cancel" ? "POST" : "GET" }, config));
    }
    if (body.action === "decide") {
      const id = Number(body.id);
      if (!Number.isSafeInteger(id) || id < 1) return json({ error: "Invalid opportunity id." }, 400);
      if (!["approved", "rejected"].includes(body.status)) return json({ error: "Invalid decision." }, 400);
      const query = new URLSearchParams({ id: "eq." + id, status: "eq.new" });
      const rows = await databaseRequest(config, "opportunities?" + query, {
        method: "PATCH",
        headers: { "content-type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ status: body.status, decided_at: new Date().toISOString() }),
      });
      if (!rows?.[0]) return json({ error: "This opportunity is no longer awaiting review." }, 409);
      return json({ opportunity: rows[0] });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reach the opportunities service.";
    return json({ error: message }, message.includes("not configured") ? 503 : 502);
  }
}
