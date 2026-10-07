import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetAuth, mockGetUser, mockStorage } = vi.hoisted(() => ({
  mockGetAuth: vi.fn(),
  mockGetUser: vi.fn(),
  mockStorage: {
    getUserByEmail: vi.fn(),
    getUserByUsername: vi.fn(),
    createUser: vi.fn(),
    initializeDefaultCategories: vi.fn(),
  },
}));

vi.mock("@clerk/express", () => ({
  getAuth: mockGetAuth,
  clerkClient: { users: { getUser: mockGetUser } },
}));
vi.mock("../storage", () => ({ storage: mockStorage }));

import { requireAuth } from "./requireAuth";

function run() {
  const req: any = {};
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  const next = vi.fn();
  return { req, res, next, done: requireAuth(req, res, next) };
}

const clerkUser = (email: string, verified = true) => ({
  primaryEmailAddressId: "e1",
  emailAddresses: [
    {
      id: "e1",
      emailAddress: email,
      verification: { status: verified ? "verified" : "unverified" },
    },
  ],
});

describe("requireAuth", () => {
  beforeEach(() => {
    Object.values(mockStorage).forEach((fn) => fn.mockReset());
    mockGetAuth.mockReset();
    mockGetUser.mockReset();
    mockStorage.getUserByUsername.mockResolvedValue(undefined);
  });

  it("returns 401 when there is no Clerk session", async () => {
    mockGetAuth.mockReturnValue({ userId: null, sessionClaims: null });
    const { res, next, done } = run();
    await done;
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches an existing user row when the email matches", async () => {
    const existing = { id: 5, email: "old@example.com" };
    mockGetAuth.mockReturnValue({
      userId: "user_existing",
      sessionClaims: { email: "old@example.com" },
    });
    mockStorage.getUserByEmail.mockResolvedValue(existing);

    const { req, next, done } = run();
    await done;

    expect(req.user).toBe(existing);
    expect(next).toHaveBeenCalled();
    expect(mockStorage.createUser).not.toHaveBeenCalled();
    expect(mockStorage.initializeDefaultCategories).not.toHaveBeenCalled();
  });

  it("falls back to Clerk's verified primary email when the token has none", async () => {
    const existing = { id: 6, email: "fallback@example.com" };
    mockGetAuth.mockReturnValue({ userId: "user_fallback", sessionClaims: {} });
    mockGetUser.mockResolvedValue(clerkUser("fallback@example.com"));
    mockStorage.getUserByEmail.mockResolvedValue(existing);

    const { req, next, done } = run();
    await done;

    expect(mockStorage.getUserByEmail).toHaveBeenCalledWith("fallback@example.com");
    expect(req.user).toBe(existing);
    expect(next).toHaveBeenCalled();
  });

  it("caches the Clerk email lookup per user", async () => {
    mockGetAuth.mockReturnValue({ userId: "user_cached", sessionClaims: {} });
    mockGetUser.mockResolvedValue(clerkUser("cached@example.com"));
    mockStorage.getUserByEmail.mockResolvedValue({ id: 7 });

    await run().done;
    await run().done;

    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });

  it("returns 401 when the primary email is not verified", async () => {
    mockGetAuth.mockReturnValue({ userId: "user_unverified", sessionClaims: {} });
    mockGetUser.mockResolvedValue(clerkUser("nope@example.com", false));

    const { res, next, done } = run();
    await done;

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(mockStorage.createUser).not.toHaveBeenCalled();
  });

  it("returns 500 when the Clerk lookup fails", async () => {
    mockGetAuth.mockReturnValue({ userId: "user_err", sessionClaims: {} });
    mockGetUser.mockRejectedValue(new Error("clerk down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { res, next, done } = run();
    await done;

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it("creates a row and default categories for a brand-new user", async () => {
    const created = { id: 9, email: "new.person@example.com" };
    mockGetAuth.mockReturnValue({
      userId: "user_new",
      sessionClaims: { email: "new.person@example.com" },
    });
    mockStorage.getUserByEmail.mockResolvedValue(undefined);
    mockStorage.createUser.mockResolvedValue(created);

    const { req, next, done } = run();
    await done;

    expect(mockStorage.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "new.person@example.com", username: "newperson" }),
    );
    expect(mockStorage.initializeDefaultCategories).toHaveBeenCalledWith(9);
    expect(req.user).toBe(created);
    expect(next).toHaveBeenCalled();
  });

  it("picks a numbered username when the base one is taken", async () => {
    mockGetAuth.mockReturnValue({
      userId: "user_dupe",
      sessionClaims: { email: "sam@example.com" },
    });
    mockStorage.getUserByEmail.mockResolvedValue(undefined);
    mockStorage.getUserByUsername.mockImplementation(async (u: string) =>
      u === "sam" ? { id: 1 } : undefined,
    );
    mockStorage.createUser.mockResolvedValue({ id: 10 });

    await run().done;

    expect(mockStorage.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ username: "sam1" }),
    );
  });

  it("recovers from a concurrent first-request race", async () => {
    const winner = { id: 11, email: "race@example.com" };
    mockGetAuth.mockReturnValue({
      userId: "user_race",
      sessionClaims: { email: "race@example.com" },
    });
    mockStorage.getUserByEmail
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(winner);
    mockStorage.createUser.mockRejectedValue(new Error("unique violation"));

    const { req, next, done } = run();
    await done;

    expect(req.user).toBe(winner);
    expect(next).toHaveBeenCalled();
  });
});
