import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sparkles, Loader2, Calendar, AlertTriangle, RefreshCw, Clock } from "lucide-react";
import Header from "@/components/Header";
import DOMPurify from "dompurify";

function parseErrorMessage(raw: string): string {
  if (raw.startsWith("AI_KEY_MISSING:")) {
    return raw.replace("AI_KEY_MISSING:", "").trim();
  }
  if (raw.startsWith("AI_KEY_INVALID:")) {
    return raw.replace("AI_KEY_INVALID:", "").trim();
  }
  if (raw.startsWith("AI_QUOTA_EXCEEDED:")) {
    return raw.replace("AI_QUOTA_EXCEEDED:", "").trim();
  }
  if (raw.startsWith("AI_RATE_LIMITED:")) {
    return raw.replace("AI_RATE_LIMITED:", "").trim();
  }
  if (raw.startsWith("AI_SERVICE_DOWN:")) {
    return raw.replace("AI_SERVICE_DOWN:", "").trim();
  }
  if (raw.startsWith("AI_ERROR:")) {
    return raw.replace("AI_ERROR:", "").trim();
  }
  return raw || "Something went wrong while generating insights.";
}

function formatGeneratedAt(date: Date): string {
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function AIInsightsPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState<string>(new Date().getMonth().toString());
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const savedState = localStorage.getItem("sidebar-collapsed");
    return savedState ? JSON.parse(savedState) : false;
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const savedState = localStorage.getItem("sidebar-collapsed");
      if (savedState !== null) {
        setIsSidebarCollapsed(JSON.parse(savedState));
      }
    };

    window.addEventListener('storage', handleStorageChange);

    const interval = setInterval(() => {
      const savedState = localStorage.getItem("sidebar-collapsed");
      if (savedState !== null) {
        const parsedState = JSON.parse(savedState);
        if (parsedState !== isSidebarCollapsed) {
          setIsSidebarCollapsed(parsedState);
        }
      }
    }, 500);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [isSidebarCollapsed]);

  const months = [
    { value: "0", label: "January" },
    { value: "1", label: "February" },
    { value: "2", label: "March" },
    { value: "3", label: "April" },
    { value: "4", label: "May" },
    { value: "5", label: "June" },
    { value: "6", label: "July" },
    { value: "7", label: "August" },
    { value: "8", label: "September" },
    { value: "9", label: "October" },
    { value: "10", label: "November" },
    { value: "11", label: "December" }
  ];

  const currentYear = new Date().getFullYear();
  const years = [
    { value: currentYear.toString(), label: currentYear.toString() },
    { value: (currentYear - 1).toString(), label: (currentYear - 1).toString() },
    { value: (currentYear - 2).toString(), label: (currentYear - 2).toString() }
  ];

  const cachedInsightsQuery = useQuery<{ insights: string | null; generatedAt: string | null }>({
    queryKey: ["/api/insights/cached", month, year],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/insights/cached?month=${month}&year=${year}`);
      return res.json();
    },
    staleTime: 0,
  });

  const cachedInsights = cachedInsightsQuery.data?.insights ?? null;
  const cachedGeneratedAt = cachedInsightsQuery.data?.generatedAt
    ? new Date(cachedInsightsQuery.data.generatedAt)
    : null;

  const generateInsightsMutation = useMutation({
    mutationFn: async ({ month, year }: { month: string; year: string }) => {
      const response = await apiRequest("POST", "/api/insights/generate", {
        month: parseInt(month),
        year: parseInt(year)
      });
      return response.json() as Promise<{ insights: string; generatedAt: string }>;
    },
    onSuccess: (data, variables) => {
      setErrorMessage(null);
      queryClient.setQueryData(
        ["/api/insights/cached", variables.month, variables.year],
        { insights: data.insights, generatedAt: data.generatedAt }
      );
    },
    onError: (error: Error) => {
      setErrorMessage(parseErrorMessage(error.message));
    }
  });

  const handleGenerateInsights = () => {
    setErrorMessage(null);
    generateInsightsMutation.mutate({ month, year });
  };

  const handleMonthChange = (value: string) => {
    setMonth(value);
    setErrorMessage(null);
    generateInsightsMutation.reset();
  };

  const handleYearChange = (value: string) => {
    setYear(value);
    setErrorMessage(null);
    generateInsightsMutation.reset();
  };

  const displayInsights = cachedInsights;
  const displayGeneratedAt = cachedGeneratedAt;
  const isFromCache = !!(cachedInsights && !generateInsightsMutation.isPending && generateInsightsMutation.isIdle);

  const sanitizedInsights = displayInsights
    ? DOMPurify.sanitize(displayInsights, { USE_PROFILES: { html: true } })
    : null;

  const isLoading = generateInsightsMutation.isPending || cachedInsightsQuery.isLoading;

  return (
    <div className="flex min-h-screen">
      <div className={`flex-1 transition-all duration-300 ${
        isSidebarCollapsed ? 'md:ml-[70px]' : 'md:ml-[240px]'
      }`}>
        <div className="py-6 px-4 sticky top-0 bg-background z-10">
          <Header />
        </div>

        <div className="px-4 md:px-6 max-w-4xl mx-auto pb-16">
          <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            AI Productivity Insights
          </h1>

          <p className="text-muted-foreground mb-6">
            Generate AI-powered insights and recommendations based on your task completion patterns to boost your productivity.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="col-span-1 md:col-span-4">
              <CardHeader>
                <CardTitle>Generate Insights</CardTitle>
                <CardDescription>
                  Select a month and year to analyze your completed and pending tasks.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="space-y-2 flex-1">
                    <Label htmlFor="month">Month</Label>
                    <Select value={month} onValueChange={handleMonthChange}>
                      <SelectTrigger id="month" className="w-full">
                        <SelectValue placeholder="Select month" />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map(m => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 flex-1">
                    <Label htmlFor="year">Year</Label>
                    <Select value={year} onValueChange={handleYearChange}>
                      <SelectTrigger id="year" className="w-full">
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map(y => (
                          <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button
                  onClick={handleGenerateInsights}
                  disabled={isLoading}
                  className="gap-2"
                >
                  {generateInsightsMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : cachedInsightsQuery.isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      {sanitizedInsights ? "Regenerate Insights" : "Generate Insights"}
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>

            {errorMessage && (
              <div className="col-span-1 md:col-span-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Could not generate insights</AlertTitle>
                  <AlertDescription className="mt-1 flex flex-col gap-3">
                    <span>{errorMessage}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-fit gap-2 border-destructive/50 text-destructive hover:bg-destructive/10"
                      onClick={handleGenerateInsights}
                      disabled={isLoading}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Try again
                    </Button>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {sanitizedInsights && (
              <Card className="col-span-1 md:col-span-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Analysis for {months.find(m => m.value === month)?.label} {year}
                  </CardTitle>
                  {displayGeneratedAt && (
                    <CardDescription className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Generated on {formatGeneratedAt(displayGeneratedAt)}
                      {isFromCache && (
                        <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-sm">cached</span>
                      )}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="prose prose-invert max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: sanitizedInsights }} />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
