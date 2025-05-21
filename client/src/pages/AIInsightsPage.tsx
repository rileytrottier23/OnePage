import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";

export default function AIInsightsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [month, setMonth] = useState<string>(new Date().getMonth().toString());
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  const [insights, setInsights] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    // Check localStorage for saved preference, default to false (expanded)
    const savedState = localStorage.getItem("sidebar-collapsed");
    return savedState ? JSON.parse(savedState) : false;
  });
  
  // Listen for changes to sidebar state in localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      const savedState = localStorage.getItem("sidebar-collapsed");
      if (savedState !== null) {
        setIsSidebarCollapsed(JSON.parse(savedState));
      }
    };
    
    // Check for changes to localStorage
    window.addEventListener('storage', handleStorageChange);
    
    // Check periodically (not ideal but works as a fallback)
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

  // Get all months for the dropdown
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

  // Get years (current year and 2 years back)
  const currentYear = new Date().getFullYear();
  const years = [
    { value: currentYear.toString(), label: currentYear.toString() },
    { value: (currentYear - 1).toString(), label: (currentYear - 1).toString() },
    { value: (currentYear - 2).toString(), label: (currentYear - 2).toString() }
  ];

  const generateInsightsMutation = useMutation({
    mutationFn: async ({ month, year }: { month: string; year: string }) => {
      const response = await apiRequest("POST", "/api/insights/generate", { 
        month: parseInt(month), 
        year: parseInt(year) 
      });
      return response.json();
    },
    onSuccess: (data) => {
      setInsights(data.insights);
    },
    onError: (error: Error) => {
      toast({
        title: "Error generating insights",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Handle form submission
  const handleGenerateInsights = () => {
    setInsights(null);
    generateInsightsMutation.mutate({ month, year });
  };

  return (
    <div className="flex min-h-screen">
      {/* Main content area - shifted to right to make room for side menu on desktop */}
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
                    <Select
                      value={month}
                      onValueChange={setMonth}
                    >
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
                    <Select
                      value={year}
                      onValueChange={setYear}
                    >
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
                  disabled={generateInsightsMutation.isPending}
                  className="gap-2"
                >
                  {generateInsightsMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate Insights
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
            
            {insights && (
              <Card className="col-span-1 md:col-span-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Analysis for {months.find(m => m.value === month)?.label} {year}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-invert max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: insights }} />
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