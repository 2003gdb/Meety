# Jev Integration

**Owners:** Martin, Carlos, Shrey

Uses Jev to classify matches: yes/no plus a probability for each attendee, given the user's profile and their goal for the event.

- Deterministic prompt templates with variables swapped in; no free-form prompts written by an agent
- Two uses: the pre-event match pass (~24h before) and live "should I talk to this person?" checks
- Jev is not used for model routing
- Only one team account needs working Jev access
