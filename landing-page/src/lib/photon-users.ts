import "server-only";

// Photon's Pro plan only delivers texts from phones on the project's Users list,
// and gives each user one iMessage line from a shared pool. Registering is
// idempotent: the same phone returns the same user and line.
const API = "https://spectrum.photon.codes";

interface CreateUserResponse {
  succeed?: boolean;
  message?: string;
  data?: { assignedPhoneNumber?: string };
}

/** Adds the user to the Photon project and returns the line they should text, or null on failure. */
export async function registerWithPhoton(user: {
  phone: string;
  fullName: string | null;
  email: string | null;
}): Promise<string | null> {
  const projectId = process.env.SPECTRUM_PROJECT_ID;
  const secret = process.env.SPECTRUM_PROJECT_SECRET;
  if (!projectId || !secret) {
    console.error("SPECTRUM_PROJECT_ID or SPECTRUM_PROJECT_SECRET is missing");
    return null;
  }

  const [firstName, ...rest] = (user.fullName ?? "").trim().split(/\s+/);
  try {
    const res = await fetch(`${API}/projects/${projectId}/users/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${projectId}:${secret}`).toString("base64")}`,
      },
      body: JSON.stringify({
        type: "shared",
        phoneNumber: user.phone,
        firstName: firstName || null,
        lastName: rest.join(" ") || null,
        email: user.email,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => null)) as CreateUserResponse | null;
    if (!res.ok || !body?.succeed) {
      console.error(`Photon user registration failed: ${res.status} ${body?.message ?? ""}`);
      return null;
    }
    return body.data?.assignedPhoneNumber ?? null;
  } catch (err) {
    console.error("Photon user registration crashed:", err);
    return null;
  }
}
