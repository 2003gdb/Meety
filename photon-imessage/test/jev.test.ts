import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { Ask, SystemOneResponse } from "../../jev-integration/src/jev.ts";
import { RuleBrain } from "../src/brain.js";
import type { Attendee, LumaEvent, Profile } from "../src/contracts.js";
import { Flow } from "../src/flow.js";
import { JevBrain, JevMatch, topicOf } from "../src/jev.js";
import type { Session } from "../src/state.js";
import { stubServices } from "../src/stubs.js";

delete process.env.GMI_API_KEY; // "why" lines use the fallback that quotes a fact

const GOAL = "find design partners";
const EVENT: LumaEvent = { id: "e1", name: "Agents Night SF", startsAt: new Date().toISOString() };
const USER: Profile = { id: "u1", name: "Sam Taylor", summary: "Builds an AI product for event hosts." };
const PRIYA: Attendee = {
  id: "a1",
  name: "Priya Raman",
  headline: "Head of Product",
  profile: { summary: "Runs customer interviews.", evidence: ["Ran 200 customer interviews last year."] },
};
const TOM: Attendee = { id: "a2", name: "Tom Becker", headline: "Backend engineer" };

type Question = Parameters<Ask>[1][string];
const nameIn = (q: Question) => (q.instructions as { attendee: { name: string } }).attendee.name;

/** Fake Jev: nouls come from `p`, choices from `choice`. Records every call. */
function fakeJev(p: (id: string, q: Question) => number, choice = { choice: "other", confidence: 0 }) {
  const calls: Record<string, Question>[] = [];
  const ask: Ask = async (_state, questions) => {
    calls.push(questions);
    const answers = Object.fromEntries(
      Object.entries(questions).map(([id, q]) =>
        q.type === "choice" ? [id, { type: "choice", probabilities: {}, ...choice }] : [id, { type: "noul", noul: p(id, q) }],
      ),
    );
    return { model: "fake", answers, usage: { input_tokens: 0, output_tokens: 0 } } as SystemOneResponse;
  };
  return { ask, calls };
}

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("rank asks Jev about every attendee and explains only the matches", async () => {
  const jev = fakeJev((_id, q) => (nameIn(q) === "Priya Raman" ? 0.8 : 0.2));
  const ranked = await new JevMatch({ ask: jev.ask }).rank({ profile: USER, goal: GOAL, event: EVENT, attendees: [TOM, PRIYA] });
  assert.deepEqual(
    ranked.map((v) => [v.attendee.name, v.match, v.probability]),
    [["Priya Raman", true, 0.8], ["Tom Becker", false, 0.2]],
  );
  assert.match(ranked[0]!.reason, /200 customer interviews/);
  assert.equal(ranked[1]!.reason, "");
});

test("rank saves every verdict to matches when asked", async () => {
  process.env.SUPABASE_URL = "https://meety.supabase.co";
  process.env.SUPABASE_SERVICE_KEY = "sb_secret_test";
  const posts: { url: string; body: Record<string, unknown>[] }[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    posts.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return new Response(null, { status: 201 });
  }) as typeof fetch;

  const jev = fakeJev((_id, q) => (nameIn(q) === "Priya Raman" ? 0.8 : 0.2));
  await new JevMatch({ ask: jev.ask, save: true }).rank({ profile: USER, goal: GOAL, event: EVENT, attendees: [TOM, PRIYA] });

  assert.match(posts[0]!.url, /\/rest\/v1\/matches\?on_conflict=user_id,event_id,attendee_id/);
  const rows = posts[0]!.body;
  assert.deepEqual(rows.map((r) => [r.user_id, r.event_id, r.attendee_id, r.match]), [["u1", "e1", "a1", true], ["u1", "e1", "a2", false]]);
  assert.match(String(rows[0]!.why), /200 customer interviews/);
  assert.equal(rows[1]!.why, null);
});

test("rank fails loudly when Jev answers for nobody", async () => {
  const ask: Ask = async () => {
    throw new Error("Jev systemone failed: 529");
  };
  await assert.rejects(new JevMatch({ ask }).rank({ profile: USER, goal: GOAL, event: EVENT, attendees: [TOM] }));
});

test("assess lets the topic decide when they ask about one", async () => {
  const jev = fakeJev((id) => (id === "topic" ? 0.9 : 0.3));
  const v = await new JevMatch({ ask: jev.ask }).assess({
    profile: USER, goal: GOAL, event: EVENT, attendee: PRIYA, question: "can I talk to Priya about pricing?",
  });
  assert.deepEqual(Object.keys(jev.calls[0]!), ["worth", "topic"]);
  assert.equal(v.match, true);
  assert.equal(v.probability, 0.9);
  assert.match(v.reason, /200 customer interviews/);
});

test("assess without a topic judges against their goal", async () => {
  const jev = fakeJev(() => 0.3);
  const v = await new JevMatch({ ask: jev.ask }).assess({ profile: USER, goal: GOAL, event: EVENT, attendee: TOM, question: "what about Tom" });
  assert.deepEqual(Object.keys(jev.calls[0]!), ["worth"]);
  assert.equal(v.match, false);
  assert.equal(v.probability, 0.3);
  assert.match(v.reason, /find design partners/);
});

test("topicOf only reads an 'about …' right after the name", () => {
  assert.equal(topicOf("should I talk to Sherry about fundraising?", "Sherry Liu"), "fundraising");
  assert.equal(topicOf("can I talk to priya raman about pricing", "Priya Raman"), "pricing");
  assert.equal(topicOf("what about Tom", "Tom Becker"), null);
  assert.equal(topicOf("I'm in front of Sherry, should I pitch her?", "Sherry Liu"), null);
  assert.equal(topicOf(undefined, "Sherry Liu"), null);
});

const readySession = (): Session => ({
  phone: "+15551234567",
  step: "ready",
  welcomed: true,
  history: [{ from: "agent", text: "here's who I'd find at Agents Night SF" }],
});

test("JevBrain routes open-ended messages after onboarding by Jev's intent", async () => {
  const goal = fakeJev(() => 0, { choice: "event_goal", confidence: 0.9 });
  const text = "honestly I mostly want to hire a designer";
  assert.deepEqual(await new JevBrain(new RuleBrain(), goal.ask).interpret(readySession(), text, {}), { kind: "new_goal", goal: text });
  assert.equal((goal.calls[0]!.intent as Question).type, "choice");

  const matches = fakeJev(() => 0, { choice: "matches_request", confidence: 0.8 });
  assert.deepEqual(await new JevBrain(new RuleBrain(), matches.ask).interpret(readySession(), "who should I meet again?", {}), { kind: "matches" });
});

test("JevBrain leaves unsure messages and onboarding replies to the conversation brain", async () => {
  const unsure = fakeJev(() => 0, { choice: "event_goal", confidence: 0.3 });
  assert.deepEqual(await new JevBrain(new RuleBrain(), unsure.ask).interpret(readySession(), "hmm ok", {}), { kind: "other" });

  const jev = fakeJev(() => 0, { choice: "event_goal", confidence: 0.9 });
  const onboarding: Session = { ...readySession(), step: "confirm_identity" };
  assert.deepEqual(await new JevBrain(new RuleBrain(), jev.ask).interpret(onboarding, "yep", {}), { kind: "yes" });
  assert.equal(jev.calls.length, 0);
});

test("asking for matches again after onboarding repeats them", async () => {
  const PHONE = "+15551234567";
  const jev = fakeJev(() => 0, { choice: "matches_request", confidence: 0.8 });
  const flow = new Flow(stubServices(), new JevBrain(new RuleBrain(), jev.ask), { signupUrl: "https://meety.test" });
  await flow.start({ phone: PHONE, name: "Sam Taylor" });
  await flow.handle(PHONE, "done");
  await flow.handle(PHONE, "yep");
  await flow.handle(PHONE, "yes");
  await flow.handle(PHONE, "I want to meet investors in AI infrastructure");
  assert.match((await flow.handle(PHONE, "who should I find again?")).join("\n"), /here's who I'd find at Agents Night SF/);
});
