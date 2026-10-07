import { clerkClient, getAuth } from "@clerk/express";
import { storage } from "../storage";

function usernameBaseFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "user";
  const sanitized = local.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
  return sanitized || "user";
}

// Finds a username not already taken, starting from the email's local part
// and appending a numeric suffix on collision (existing accounts may already
// occupy the base form).
async function findAvailableUsername(email: string): Promise<string> {
  const base = usernameBaseFromEmail(email);
  let candidate = base;
  let suffix = 1;
  while (await storage.getUserByUsername(candidate)) {
    candidate = `${base}${suffix}`;
    suffix++;
  }
  return candidate;
}

// Remembers each Clerk user's email so we only ask Clerk for it once.
const emailByClerkUserId = new Map<string, string>();

// The session token only carries an email if the Clerk instance has been
// configured to add one. When it's missing, look the signed-in user up in
// Clerk and use their verified primary email, so sign-in doesn't depend on
// that dashboard setting.
async function emailForClerkUser(userId: string): Promise<string | undefined> {
  const cached = emailByClerkUserId.get(userId);
  if (cached) return cached;

  const user = await clerkClient.users.getUser(userId);
  const primary = user.emailAddresses.find(
    (address) => address.id === user.primaryEmailAddressId,
  );
  if (!primary || primary.verification?.status !== "verified") {
    return undefined;
  }

  emailByClerkUserId.set(userId, primary.emailAddress);
  return primary.emailAddress;
}

/**
 * Clerk-based auth middleware, replacing Passport's per-route `ensureAuth`.
 * - Rejects unauthenticated requests with 401.
 * - Bridges the Clerk session to a local users row by email.
 * - JIT-provisions a new row (plus default categories) on first authenticated
 *   request if none exists.
 * - Sets req.user so the existing route handlers' `req.user?.id` keep working
 *   unchanged.
 */
export async function requireAuth(req: any, res: any, next: any) {
  const auth = getAuth(req);
  let email = auth?.sessionClaims?.email as string | undefined;

  if (!email && auth?.userId) {
    try {
      email = await emailForClerkUser(auth.userId);
    } catch (error) {
      console.error("requireAuth: could not load the user from Clerk:", error);
      return res.status(500).json({ error: "Authentication error" });
    }
  }

  if (!email) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    let dbUser = await storage.getUserByEmail(email);

    if (!dbUser) {
      const username = await findAvailableUsername(email);
      try {
        dbUser = await storage.createUser({
          email,
          username,
          // Clerk owns authentication; this column is kept for schema
          // compatibility only and is never checked.
          password: "__clerk_managed__",
        });
        await storage.initializeDefaultCategories(dbUser.id);
      } catch (insertError) {
        // Concurrent first-request race on the same email — someone else's
        // request already created the row.
        dbUser = await storage.getUserByEmail(email);
        if (!dbUser) throw insertError;
      }
    }

    req.user = dbUser;
    next();
  } catch (error) {
    console.error("requireAuth error:", error);
    res.status(500).json({ error: "Authentication error" });
  }
}
