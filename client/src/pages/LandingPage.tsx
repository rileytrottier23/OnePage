import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  ChevronRight, 
  CheckCircle, 
  Calendar, 
  RotateCcw, 
  Layout, 
  CheckCheck,
  ArrowRight
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function LandingPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  
  // If user is already logged in, redirect to the dashboard
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header section */}
      <header className="border-b border-border/40 py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <CheckCheck className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">OnePage</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/auth">
              <Button variant="outline" className="text-sm">
                Sign In
              </Button>
            </Link>
            <Link href="/auth">
              <Button className="text-sm">
                Get Started <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            The simplest way to manage your tasks
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            OnePage helps you organize everything in one place with a clean, minimalist interface that lets you focus on what matters.
          </p>
          <Link href="/auth">
            <Button size="lg" className="px-8 py-6 text-lg">
              Start for free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Features section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            Just what you need, nothing more
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-background p-6 rounded-lg shadow-sm border border-border/50">
              <div className="mb-4 text-primary">
                <Layout className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Everything in one view</h3>
              <p className="text-muted-foreground">
                All your tasks are visible at a glance. The "Today" section is always on top for your immediate focus.
              </p>
            </div>
            <div className="bg-background p-6 rounded-lg shadow-sm border border-border/50">
              <div className="mb-4 text-primary">
                <RotateCcw className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Repeating tasks</h3>
              <p className="text-muted-foreground">
                Set tasks to repeat daily, weekly, monthly, or quarterly. Never forget your recurring responsibilities again.
              </p>
            </div>
            <div className="bg-background p-6 rounded-lg shadow-sm border border-border/50">
              <div className="mb-4 text-primary">
                <Calendar className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Smart archiving</h3>
              <p className="text-muted-foreground">
                Completed tasks stay visible until 6am the next day, giving you time to review your accomplishments.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How OnePage works</h2>
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="flex items-start">
              <div className="bg-primary/10 p-2 rounded-full mr-4">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Create your task lists</h3>
                <p className="text-muted-foreground">
                  Organize tasks into different categories like Work, Personal, or Shopping. Use the "Today" section for tasks that need your immediate attention.
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="bg-primary/10 p-2 rounded-full mr-4">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Add subtasks for complex work</h3>
                <p className="text-muted-foreground">
                  Break down larger tasks into manageable subtasks. Create hierarchies to better organize related items.
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="bg-primary/10 p-2 rounded-full mr-4">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Set up repeating tasks</h3>
                <p className="text-muted-foreground">
                  For recurring responsibilities, set up repeating tasks that automatically recreate themselves at your chosen frequency.
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="bg-primary/10 p-2 rounded-full mr-4">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Review and archive</h3>
                <p className="text-muted-foreground">
                  Completed tasks remain visible until the next morning, helping you keep track of your accomplishments before they're automatically archived.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section className="py-16 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to simplify your task management?</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join OnePage today and experience a cleaner, more focused way to organize your life.
          </p>
          <Link href="/auth">
            <Button size="lg" className="px-8">
              Get started for free
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border/40">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <CheckCheck className="h-5 w-5 text-primary" />
              <span className="font-semibold">OnePage</span>
            </div>
            <div className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} OnePage. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}