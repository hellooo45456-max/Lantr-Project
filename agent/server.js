import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import { Agent, run, tool, webSearchTool } from '@openai/agents';
import { z } from 'zod';

const PORT = Number.parseInt(process.env.PORT || '8080', 10);
const MAX_SEARCHES = 10;
const MAX_PAGE_READS = 15;
const JOB_TIMEOUT_MS = 4 * 60 * 1000;
const jobs = new Map();

loadEnvFile(new URL('./.env', import.meta.url));

function loadEnvFile(url) {
  let contents;
  try {
    contents = readFileSync(url, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return;
    throw error;
  }
  const lines = contents.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

function required(name) {
  if (!process.env[name]) throw new Error(name + ' is not configured.');
  return process.env[name];
}

function safeEqual(value, expected) {
  const valueBuffer = Buffer.from(value || '');
  const expectedBuffer = Buffer.from(expected);
  return valueBuffer.length === expectedBuffer.length && timingSafeEqual(valueBuffer, expectedBuffer);
}

function parseInterests() {
  const text = readFileSync(new URL('./interests.txt', import.meta.url), 'utf8');
  const fields = Object.fromEntries(text.split(/\r?\n/).map((line) => {
    const index = line.indexOf(':');
    return index === -1 ? [] : [line.slice(0, index).trim(), line.slice(index + 1).trim()];
  }).filter((entry) => entry.length));
  if (!fields.Age || !fields.City || !fields.Interests) {
    throw new Error('interests.txt must contain Age, City, and Interests.');
  }
  return fields;
}

function privateAddress(address) {
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    if (lower.startsWith('::ffff:')) return privateAddress(lower.slice(7));
    return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:');
  }
  const [a, b] = address.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
}

async function validatePublicUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port))) {
    throw new Error('open_page accepts only public HTTP(S) URLs.');
  }
  if (url.hostname === 'localhost' || url.hostname.endsWith('.local')) throw new Error('Local URLs are not allowed.');
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((entry) => privateAddress(entry.address))) throw new Error('Non-public URLs are not allowed.');
  return url;
}

async function readPublicPage(urlValue, signal) {
  let url = await validatePublicUrl(urlValue);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetch(url, {
      signal,
      redirect: 'manual',
      headers: { 'user-agent': 'OpportunityAgent/1.0 (+local verification tool)' },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('The page redirected without a destination.');
      url = await validatePublicUrl(new URL(location, url).href);
      continue;
    }
    if (!response.ok) throw new Error('The page returned HTTP ' + response.status + '.');
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      throw new Error('The page is not readable HTML or text.');
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 1_000_000) throw new Error('The page is too large to read.');
    const html = new TextDecoder().decode(bytes);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/\s+/g, ' ')
      .trim();
    return { url: url.href, text: text.slice(0, 14_000) };
  }
  throw new Error('Too many redirects.');
}

function makeOpenPageTool(job) {
  return tool({
    name: 'open_page',
    description: 'Read one public web page. Use it after web search to verify a candidate opportunity from its official source. Returns readable text and the final URL.',
    parameters: z.object({ url: z.string().describe('The public page URL to read.') }),
    async execute({ url }) {
      if (job.searches === 0) return 'Use web search before opening a page.';
      if (job.pageReads >= MAX_PAGE_READS) return 'Page-read limit reached. Do not open more pages.';
      if (job.controller.signal.aborted) return 'This job has been cancelled or timed out.';
      job.pageReads += 1;
      job.activity.push({ type: 'read', url, at: Date.now() });
      console.log('[' + job.id + '] tool call: open_page (' + job.pageReads + '/' + MAX_PAGE_READS + ')');
      try {
        const page = await readPublicPage(url, job.controller.signal);
        return 'URL: ' + page.url + '\n\n' + page.text;
      } catch (error) {
        return 'Unable to read this page: ' + error.message + '. Try another official source.';
      }
    },
  });
}

const opportunityOutput = z.object({
  opportunities: z.array(z.object({
    title: z.string(),
    organiser: z.string(),
    location: z.string(),
    url: z.string(),
    eligibilityEvidence: z.string(),
    availabilityEvidence: z.string(),
    sourceExcerpt: z.string(),
  })).max(5),
  ruledOut: z.array(z.string()),
  note: z.string(),
});

function makeAgent(job, profile) {
  return new Agent({
    name: 'Verified opportunity finder',
    model: 'gpt-6-astra',
    outputType: opportunityOutput,
    tools: [webSearchTool({ searchContextSize: 'low' }), makeOpenPageTool(job)],
    modelSettings: {
      maxTokens: 3000,
      reasoning: { effort: 'low' },
      text: { verbosity: 'low' },
    },
    instructions:
      'Find current opportunities for this person: age ' + profile.Age + ', city ' + profile.City + ', interests: ' + profile.Interests + '. ' +
      'Search first. You may use web search at most ' + MAX_SEARCHES + ' times, and must call open_page at most ' + MAX_PAGE_READS + ' times. ' +
      'Print-quality evidence matters more than the number of results. For every shortlisted item, read an official organiser page using open_page and check: exact age eligibility, location or online access, and that applications/registration are open now. ' +
      'Do not assume school, skill level, citizenship, experience, or parental permission. Include no more than five items and only items you actually checked. ' +
      'For each item, supply short direct evidence for eligibility and availability plus a short source excerpt. ' +
      'If evidence is missing, investigate another official page before accepting or rejecting it. If you cannot verify enough, return fewer items. ' +
      'List meaningful exclusions in ruledOut and explain uncertainty in note. Never invent results, dates, eligibility, availability, or quotes.',
  });
}

function publicJob(job) {
  const base = {
    id: job.id,
    status: job.status,
    searches: job.searches,
    pageReads: job.pageReads,
    elapsedMs: Math.min(Date.now() - job.startedAt, JOB_TIMEOUT_MS),
    activity: job.activity,
  };
  if (job.status === 'completed') base.results = job.results;
  if (job.status === 'failed' || job.status === 'cancelled') base.error = job.error;
  return base;
}

async function runJob(job) {
  try {
    const profile = parseInterests();
    required('OPENAI_API_KEY');
    const agent = makeAgent(job, profile);
    const stream = await run(agent, 'Find verified current opportunities now.', {
      stream: true,
      signal: job.controller.signal,
      maxTurns: 30,
    });
    for await (const event of stream) {
      if (event.type !== 'run_item_stream_event' || event.name !== 'tool_called') continue;
      const serialized = JSON.stringify(event.item.rawItem ?? event.item);
      if (serialized.includes('web_search')) {
        job.searches += 1;
        const raw = event.item.rawItem ?? event.item;
        const query = raw?.action?.query || raw?.query || 'Web search';
        job.activity.push({ type: 'search', query, at: Date.now() });
        console.log('[' + job.id + '] tool call: web_search (' + job.searches + '/' + MAX_SEARCHES + ')');
        if (job.searches > MAX_SEARCHES) {
          job.controller.abort();
          throw new Error('Search limit exceeded.');
        }
      } else if (serialized.includes('open_page')) {
        console.log('[' + job.id + '] tool call: open_page requested');
      } else {
        console.log('[' + job.id + '] tool call: unknown tool');
      }
    }
    await stream.completed;
    if (job.controller.signal.aborted) throw new Error(job.timedOut ? 'Job exceeded the four-minute limit.' : 'Job was cancelled.');
    job.results = stream.finalOutput;
    job.activity.push({ type: 'checking', at: Date.now() });
    job.status = 'completed';
  } catch (error) {
    job.status = job.controller.signal.aborted ? 'cancelled' : 'failed';
    job.error = job.timedOut ? 'Job exceeded the four-minute limit.' : (error instanceof Error ? error.message : 'The job failed.');
  } finally {
    clearTimeout(job.timeout);
  }
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let data = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      data += chunk;
      if (data.length > 20_000) request.destroy();
    });
    request.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('Request body must be JSON.')); }
    });
    request.on('error', reject);
  });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  try {
    if (request.method === 'GET' && url.pathname === '/') {
      response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('agent is running');
      return;
    }

    const providedSecret = request.headers.agent_secret;
    if (!safeEqual(Array.isArray(providedSecret) ? providedSecret[0] : providedSecret, required('AGENT_SECRET'))) {
      sendJson(response, 401, { error: 'Unauthorized' });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/jobs') {
      await readJson(request);
      const job = {
        id: randomUUID(),
        status: 'running',
        searches: 0,
        pageReads: 0,
        activity: [],
        startedAt: Date.now(),
        controller: new AbortController(),
        timedOut: false,
      };
      job.timeout = setTimeout(() => {
        job.timedOut = true;
        job.controller.abort();
      }, JOB_TIMEOUT_MS);
      jobs.set(job.id, job);
      void runJob(job);
      sendJson(response, 202, { id: job.id });
      return;
    }

    const jobMatch = url.pathname.match(/^\/jobs\/([0-9a-f-]+)$/i);
    if (request.method === 'GET' && jobMatch) {
      const job = jobs.get(jobMatch[1]);
      if (!job) return sendJson(response, 404, { error: 'Job not found' });
      return sendJson(response, 200, publicJob(job));
    }

    const cancelMatch = url.pathname.match(/^\/jobs\/([0-9a-f-]+)\/cancel$/i);
    if (request.method === 'POST' && cancelMatch) {
      const job = jobs.get(cancelMatch[1]);
      if (!job) return sendJson(response, 404, { error: 'Job not found' });
      if (job.status === 'running') {
        job.controller.abort();
        job.status = 'cancelled';
        job.error = 'Job was cancelled.';
      }
      return sendJson(response, 200, publicJob(job));
    }

    sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : 'Bad request' });
  }
});

server.listen(PORT, () => console.log('Opportunity agent listening on port ' + PORT));
