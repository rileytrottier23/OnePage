import { useAuth as useClerkAuth, useClerk } from "@clerk/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Thin wrapper over Clerk's session state that also fetches the app's own
// DB-backed user row (id, username, email) via /api/user, keyed off Clerk's
// session cookie. Kept as a hook with this exact shape so existing consumers
// (Header.tsx) don't need to change.
export function useAuth() {
  const { toast } = useToast();
  const { isLoaded, isSignedIn } = useClerkAuth();
  const { signOut } = useClerk();

  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | undefined, Error>({
    queryKey: ["/api/user"],
    enabled: isLoaded && isSignedIn,
    queryFn: async ({ signal }) => {
      try {
        const res = await fetch("/api/user", { signal });
        if (res.status === 401) return undefined;
        if (!res.ok) throw new Error("Failed to fetch user");
        return await res.json();
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return undefined;
        }
        throw err;
      }
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await signOut();
    },
    onSuccess: () => {
      // Clear all query cache to prevent data leakage between users
      queryClient.clear();
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    user: isSignedIn ? (user ?? null) : null,
    isLoading: !isLoaded || (isSignedIn && isLoading),
    error: error ?? null,
    logoutMutation,
  };
}
