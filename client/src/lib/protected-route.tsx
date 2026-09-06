import { useAuth as useClerkAuth } from "@clerk/react";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: React.ComponentType;
}) {
  const { isLoaded, isSignedIn } = useClerkAuth();

  return (
    <Route
      path={path}
      component={() => {
        if (!isLoaded) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-border" />
            </div>
          );
        }

        if (!isSignedIn) {
          return <Redirect to="/sign-in" />;
        }

        return <Component />;
      }}
    />
  );
}
