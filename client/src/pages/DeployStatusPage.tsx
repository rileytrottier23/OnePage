import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, MinusCircle, ExternalLink, RefreshCw, GitCommit, Clock } from "lucide-react";

interface DeployStatus {
  status: "success" | "failure" | "up-to-date" | "unknown";
  timestamp: string | null;
  sha: string | null;
  error: string | null;
  actionsUrl: string | null;
}

function StatusBadge({ status }: { status: DeployStatus["status"] }) {
  if (status === "success") {
    return (
      <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 gap-1.5 px-3 py-1 text-sm">
        <CheckCircle2 className="h-4 w-4" />
        Success
      </Badge>
    );
  }
  if (status === "up-to-date") {
    return (
      <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 gap-1.5 px-3 py-1 text-sm">
        <MinusCircle className="h-4 w-4" />
        Already up-to-date
      </Badge>
    );
  }
  if (status === "failure") {
    return (
      <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 gap-1.5 px-3 py-1 text-sm">
        <XCircle className="h-4 w-4" />
        Failed
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-sm">
      <MinusCircle className="h-4 w-4" />
      No sync recorded
    </Badge>
  );
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return ts;
  }
}

function shortSha(sha: string | null): string {
  if (!sha) return "—";
  return sha.slice(0, 7);
}

export default function DeployStatusPage() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<DeployStatus>({
    queryKey: ["/api/deploy-status"],
    refetchInterval: 30_000,
  });

  const status = data?.status ?? "unknown";
  const isSuccess = status === "success" || status === "up-to-date";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 md:pl-[260px]">
        <Header />

        <div className="mt-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Deploy Status</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Result of the last GitHub sync triggered during publish.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {isLoading ? (
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48 mt-1" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ) : isError ? (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive flex items-center gap-2">
                  <XCircle className="h-5 w-5" />
                  Unable to load status
                </CardTitle>
                <CardDescription>
                  Could not reach the status endpoint. Make sure the server is running.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <Card className={
              isSuccess
                ? "border-green-500/30"
                : status === "failure"
                ? "border-red-500/30"
                : ""
            }>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">Last Sync Result</CardTitle>
                    <CardDescription className="mt-0.5">
                      {status === "unknown"
                        ? "No sync has been recorded yet. Run a deploy to populate this."
                        : "Updated automatically each time the sync script runs."}
                    </CardDescription>
                  </div>
                  <StatusBadge status={status} />
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0" />
                    Timestamp
                  </div>
                  <span className="font-mono">
                    {formatTimestamp(data?.timestamp ?? null)}
                  </span>

                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <GitCommit className="h-4 w-4 shrink-0" />
                    Commit SHA
                  </div>
                  <span className="font-mono">
                    {data?.sha ? (
                      <a
                        href={`https://github.com/rileytrottier23/OnePage/commit/${data.sha}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline text-primary"
                      >
                        {shortSha(data.sha)}
                      </a>
                    ) : (
                      "—"
                    )}
                  </span>
                </div>

                {status === "failure" && data?.error && (
                  <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3">
                    <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">
                      Error details
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-300 break-words whitespace-pre-wrap leading-relaxed">
                      {data.error}
                    </p>
                  </div>
                )}

                {data?.actionsUrl && (
                  <div className="pt-2 border-t">
                    <Button variant="outline" size="sm" asChild className="gap-2">
                      <a
                        href={data.actionsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View GitHub Actions
                      </a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <p className="text-xs text-muted-foreground">
            This page auto-refreshes every 30 seconds. The status is written by{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">
              scripts/sync-to-github.sh
            </code>{" "}
            at the end of each deploy.
          </p>
        </div>
      </div>
    </div>
  );
}
