import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JOB_ID = /^[0-9a-f-]{36}$/i;

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
  if (!sitePassword || !agentUrl || !agentSecret) {
    throw new Error("The opportunities service is not configured on this server.");
  }
  return { sitePassword, agentUrl: agentUrl.replace(/\/$/, ""), agentSecret };
}

async function agentRequest(path, options, config) {
  const response = await fetch(config.agentUrl + path, {
    ...options,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
    headers: {
      "content-type": "application/json",
      AGENT_SECRET: config.agentSecret,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The opportunity agent could not complete that request.");
  return data;
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
      const job = await agentRequest(path, { method: body.action === "cancel" ? "POST" : "GET" }, config);
      return json(job);
    }

    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reach the opportunities service.";
    return json({ error: message }, message.includes("not configured") ? 503 : 502);
  }
}
