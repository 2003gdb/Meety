# Browserbase × Luma

**Owner:** Jozi

Uses Browserbase with the user's own Luma credentials to pull their upcoming events and each event's attendee list. The Luma MCP is host-only, so it isn't used, and exploit-based access is off the table.

- First thing to prove: can Browserbase read an event's attendee list while logged in as the user?
- Ask for the login once, then save the cookies/session for later runs
- Some events hide the guest list, so this has to cope with that
