import "server-only";

// Pass 1 of tavily-research for a new sign-up: find who they are and write it
// onto their profiles row, where the iMessage bot reads it for "is this you?".
// Runs after the response (see onboarding/actions.ts), so it never slows or
// breaks sign-up. Needs TAVILY_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
// (GMI_API_KEY optional) on the server.
import { confirmUser, findUserCandidates } from "@research/research.ts";
import { saveCandidates, saveUserResearch } from "@research/store.ts";

export interface NewProfile {
  id: string;
  name: string;
  email: string;
  linkedinUrl: string | null;
  xHandle: string | null;
}

export async function researchNewProfile(profile: NewProfile): Promise<void> {
  const person = { profile_id: profile.id, name: profile.name };
  try {
    const links = [profile.linkedinUrl, profile.xHandle && `https://x.com/${profile.xHandle}`]
      .filter((url): url is string => Boolean(url));
    if (links.length) {
      // They gave us their own links, so there's nothing to guess.
      await saveUserResearch(profile.id, await confirmUser(person, links));
      return;
    }

    const { candidates } = await findUserCandidates(profile.name, profile.email);
    await saveCandidates(profile.id, candidates);
    if (!candidates[0]) return;

    // Summarize the likeliest match so "is this you?" shows real detail. It stays
    // 'ambiguous', without its link, until they confirm it over iMessage.
    const research = await confirmUser(person, [candidates[0].url]);
    if (research.research_status === "done") {
      await saveUserResearch(profile.id, {
        ...research,
        research_status: "ambiguous",
        linkedin_url: null,
        x_url: null,
      });
    }
  } catch (err) {
    console.error(`Research for profile ${profile.id} failed:`, err);
  }
}
