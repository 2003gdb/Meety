# Browserbase × Luma

**Owner:** Jozi

Uses Browserbase with the user's own Luma credentials to pull their upcoming events and each event's attendee list. The Luma MCP is host-only, so it isn't used, and exploit-based access is off the table.

- First thing to prove: can Browserbase read an event's attendee list while logged in as the user?
- Ask for the login once, then save the cookies/session for later runs
- Some events hide the guest list, so this has to cope with that

## Run

```bash
cd browserbase-luma
cp .env.example .env
npm install
npm run connect
```

`connect` prints a Browserbase Live View URL. Open it and sign in to Luma with the email code (type the email in that browser, then the 6-digit code from the inbox). That login is saved as a Browserbase context id in `data/luma-session.json`. The password is never stored, because Luma doesn't use one.

When the login is done:

```bash
npm run pull
```

`pull` closes the login session so the cookies persist, opens a new session on the same context, and prints upcoming events plus the guest profiles visible on the next event. If the host hid the list, `guestListVisible` is false and `guests` is empty. The same JSON is written to `data/luma-pull.json`.
