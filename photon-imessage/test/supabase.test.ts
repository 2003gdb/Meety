import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { SupabaseLuma, SupabaseResearch, SupabaseUsers } from "../src/supabase.js";
import { stubServices } from "../src/stubs.js";

process.env.SUPABASE_URL = "https://meety.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "sb_secret_test";
process.env.TAVILY_API_KEY = "tvly-test";
delete process.env.GMI_API_KEY; // summaries use tavily-research's heuristic fallback

const PHONE = "+15551234567";
const USER = { phone: PHONE, name: "Martin Galaz" };
const LINKEDIN = "https://www.linkedin.com/in/martingalaz";

type Call = { url: string; method: string; body?: Record<string, unknown> };
let calls: Call[];
let rows: Record<string, unknown>[];

// One fake for both APIs: Supabase answers with `rows`, Tavily extract with a LinkedIn page.
beforeEach(() => {
  calls = [];
  rows = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.startsWith("https://api.tavily.com/extract")) {
      const raw_content = "# Martin Galaz\nPartner Integration at Autodesk\nSan Francisco Bay Area\nAbout\nBuilds partner integrations.";
      return Response.json({ results: [{ url: LINKEDIN, raw_content }] });
    }
    if (method === "PATCH") return new Response(null, { status: 204 });
    return Response.json(rows);
  }) as typeof fetch;
});

const row = (fields: Record<string, unknown>) => ({
  id: "p1",
  full_name: "Martin Galaz",
  email: "martin@autodesk.com",
  phone: PHONE,
  linkedin_url: null,
  x_handle: null,
  headline: null,
  summary: null,
  candidates: null,
  research_status: "pending",
  ...fields,
});
const patches = () => calls.filter((c) => c.method === "PATCH");

test("findByPhone reads the landing page's profiles row", async () => {
  rows = [row({ linkedin_url: LINKEDIN, x_handle: "martingalaz" })];
  const user = await new SupabaseUsers().findByPhone(PHONE);
  assert.deepEqual(user, {
    phone: PHONE,
    name: "Martin Galaz",
    email: "martin@autodesk.com",
    linkedinUrl: LINKEDIN,
    xUrl: "https://x.com/martingalaz",
  });
  assert.match(calls[0]!.url, /\/rest\/v1\/profiles\?.*phone=eq\.%2B15551234567/);
});

test("findByPhone is null for a number that never signed up", async () => {
  assert.equal(await new SupabaseUsers().findByPhone(PHONE), null);
});

test("upsert only saves links the user texted in", async () => {
  await new SupabaseUsers().upsert({ phone: PHONE, name: "Martin Galaz" });
  assert.equal(patches().length, 0);
  await new SupabaseUsers().upsert({ phone: PHONE, xUrl: "https://x.com/martingalaz" });
  assert.deepEqual(patches()[0]!.body, { x_handle: "martingalaz" });
});

test("profileFor uses the research written at sign-up", async () => {
  rows = [row({ headline: "Partner Integration @ Autodesk", summary: "Builds partner integrations at Autodesk.", linkedin_url: LINKEDIN })];
  const profile = await new SupabaseResearch().profileFor(USER);
  assert.equal(profile?.summary, "Builds partner integrations at Autodesk.");
  assert.equal(profile?.headline, "Partner Integration @ Autodesk");
  assert.equal(profile?.linkedinUrl, LINKEDIN);
});

test("profileFor falls back to the top 'Is this you?' candidate", async () => {
  rows = [row({ candidates: [{ url: LINKEDIN, label: "Autodesk · San Francisco Bay Area", source: "linkedin" }] })];
  const profile = await new SupabaseResearch().profileFor(USER);
  assert.equal(profile?.summary, "Martin Galaz, Autodesk · San Francisco Bay Area");
  assert.equal(profile?.linkedinUrl, LINKEDIN);
});

test("profileFor is null while nothing was found", async () => {
  rows = [row({})];
  assert.equal(await new SupabaseResearch().profileFor(USER), null);
});

const CANDIDATE = { url: LINKEDIN, label: "Autodesk · San Francisco Bay Area", source: "linkedin" };

test("confirm marks the best guess done and keeps its link", async () => {
  rows = [row({ summary: "Builds partner integrations at Autodesk.", candidates: [CANDIDATE], research_status: "ambiguous" })];
  await new SupabaseResearch().confirm(USER);
  assert.match(patches()[0]!.url, /profiles\?id=eq\.p1/);
  assert.deepEqual(patches()[0]!.body, { research_status: "done", linkedin_url: LINKEDIN });
});

test("confirm leaves research that is already confirmed alone", async () => {
  // e.g. built from links the user texted after rejecting the guess
  rows = [row({ summary: "From their own links.", candidates: [CANDIDATE], research_status: "done" })];
  await new SupabaseResearch().confirm(USER);
  assert.equal(patches().length, 0);
});

test("profileFromLinks researches the links with Tavily and saves them", async () => {
  rows = [row({})];
  const profile = await new SupabaseResearch().profileFromLinks(USER, { linkedinUrl: LINKEDIN });
  assert.ok(calls.some((c) => c.url === "https://api.tavily.com/extract"));
  assert.equal(profile?.summary, "Builds partner integrations.");
  assert.equal(profile?.headline, "Partner Integration at Autodesk");

  const saved = patches()[0]!;
  assert.match(saved.url, /profiles\?id=eq\.p1/);
  assert.equal(saved.body?.research_status, "done");
  assert.equal(saved.body?.linkedin_url, LINKEDIN);
});

const luma = () => new SupabaseLuma(stubServices().luma);

test("upcomingEvents offers events from the events table, soonest first", async () => {
  rows = [{ id: "e1", name: "Agents Night SF", luma_url: "https://lu.ma/agents", starts_at: "2026-09-27T01:00:00Z" }];
  const events = await luma().upcomingEvents(USER);
  assert.deepEqual(events, [{ id: "e1", name: "Agents Night SF", startsAt: "2026-09-27T01:00:00Z", url: "https://lu.ma/agents" }]);
  assert.match(calls[0]!.url, /\/rest\/v1\/events\?.*starts_at=gte\..*order=starts_at/);
});

test("attendees come from the attendees table, shaped for Jev", async () => {
  rows = [
    { id: "a1", event_id: "e1", name: "Maya Chen", headline: "Founding engineer", company: "Northwind Labs", bio: "Builds agent tooling.",
      linkedin_url: LINKEDIN, x_handle: null, research_status: "done", summary: "Ex-Stripe.", interests: ["agents"], evidence: ["Spoke at AI Engineer Summit."] },
  ];
  const [maya] = (await luma().attendees(USER, "e1"))!;
  assert.equal(maya!.id, "a1");
  assert.equal(maya!.headline, "Founding engineer at Northwind Labs");
  assert.equal(maya!.profileUrl, LINKEDIN);
  assert.equal(maya!.profile?.summary, "Builds agent tooling. Ex-Stripe.");
  assert.deepEqual(maya!.profile?.interests, ["agents"]);
  assert.deepEqual(maya!.profile?.evidence, ["Spoke at AI Engineer Summit."]);
});

test("an event with no scraped guests reads as a hidden guest list", async () => {
  assert.equal(await luma().attendees(USER, "e1"), null);
});

test("connecting to Luma is still the Browserbase stub", async () => {
  assert.equal(await luma().isConnected(USER), true);
  assert.match(await luma().connectUrl(USER), /connect-luma/);
});
