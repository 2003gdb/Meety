import assert from "node:assert/strict";
import { test } from "node:test";
import { RuleBrain, rules } from "../src/brain.js";
import { Flow } from "../src/flow.js";
import { Inbox } from "../src/inbox.js";
import { stubServices } from "../src/stubs.js";
import { normalizeHandle } from "../src/transport.js";

const PHONE = "+15551234567";
const newFlow = () => new Flow(stubServices(), new RuleBrain(), { signupUrl: "https://meety.test" });
const joined = (out: string[]) => out.join("\n");

test("unregistered senders get the sign-up link and nothing else", async () => {
  const flow = newFlow();
  const out = await flow.handle(PHONE, "hey who should I meet");
  assert.match(joined(out), /meety\.test/);
  assert.equal(flow.sessions.get(PHONE), undefined);
});

test("onboarding runs from handoff to matches, then answers live questions", async () => {
  const flow = newFlow();
  const s = () => flow.sessions.get(PHONE)!;

  assert.match(joined(await flow.start({ phone: PHONE, name: "Sam Taylor" })), /log into Luma/);
  assert.match(joined(await flow.handle(PHONE, "done")), /is this you/);
  assert.equal(s().step, "confirm_identity");

  assert.match(joined(await flow.handle(PHONE, "yep")), /Agents Night SF/);
  assert.equal(s().step, "pick_event");

  assert.match(joined(await flow.handle(PHONE, "yes")), /what do you want to get out of Agents Night SF/);
  const matches = joined(await flow.handle(PHONE, "I want to talk to customers about product and meet investors in AI infrastructure"));
  assert.equal(s().step, "ready");
  assert.match(matches, /Priya Raman|Sherry Liu/);

  assert.match(joined(await flow.handle(PHONE, "I'm in front of Sherry, should I pitch her?")), /^yes, \d+%/);
  assert.match(joined(await flow.handle(PHONE, "what about Tom")), /^probably not/);
});

test("'that's not me' asks for links and re-checks identity", async () => {
  const flow = newFlow();
  await flow.start({ phone: PHONE, name: "Sam Taylor" });
  await flow.handle(PHONE, "done");
  assert.match(joined(await flow.handle(PHONE, "no")), /LinkedIn/);
  const out = await flow.handle(PHONE, "linkedin.com/in/samtaylor");
  assert.match(joined(out), /is this you/);
  assert.match(joined(out), /linkedin\.com\/in\/samtaylor/);
});

test("declining the first event lists the others and accepts a number", async () => {
  const flow = newFlow();
  await flow.start({ phone: PHONE, name: "Sam Taylor" });
  await flow.handle(PHONE, "done");
  await flow.handle(PHONE, "yes");
  assert.match(joined(await flow.handle(PHONE, "nah")), /1\. Agents Night SF/);
  assert.match(joined(await flow.handle(PHONE, "3")), /Devtools Meetup/);
  // Devtools Meetup hides its guest list in the stubs.
  assert.match(joined(await flow.handle(PHONE, "hiring engineers")), /hid the guest list/);
  // Off-list person described in the message still gets a verdict.
  assert.match(joined(await flow.handle(PHONE, "I'm talking to Dana, she runs a devtools company and is hiring engineers")), /%/);
});

test("rules", () => {
  assert.deepEqual(rules("connect_luma", "done!"), { kind: "done" });
  assert.deepEqual(rules("pick_event", "2"), { kind: "choice", index: 1 });
  assert.deepEqual(rules("ask_links", "@samtaylor"), { kind: "links", linkedinUrl: undefined, xUrl: "https://x.com/samtaylor" });
  assert.deepEqual(rules("ready", "different event pls"), { kind: "switch_event" });
  assert.equal(rules("ready", "can I talk to priya about pricing?", ["Priya Raman"])?.kind, "ask_person");
});

test("normalizeHandle", () => {
  assert.equal(normalizeHandle("(555) 123-4567"), "+15551234567");
  assert.equal(normalizeHandle("+1 555 123 4567"), "+15551234567");
  assert.equal(normalizeHandle("Sam@iCloud.com"), "sam@icloud.com");
});

test("inbox debounces a burst into one turn and drops duplicate deliveries", async () => {
  const turns: string[][] = [];
  const inbox = new Inbox<null>(20, async (_k, texts) => void turns.push(texts));
  inbox.push("chat", "m1", "hey", null);
  inbox.push("chat", "m2", "wait", null);
  inbox.push("chat", "m2", "wait", null);
  inbox.push("chat", "m3", "who is Priya", null);
  await new Promise((r) => setTimeout(r, 60));
  await inbox.drain();
  assert.deepEqual(turns, [["hey", "wait", "who is Priya"]]);
});
