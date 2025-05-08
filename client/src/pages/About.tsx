import { Link } from "wouter";
import { ArrowLeft, CheckCircle, MousePointerClick, Keyboard, Clipboard, Edit3, GripHorizontal, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import { useState, useEffect } from "react";

export default function About() {
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
    
    // Check periodically
    const checkLocalStorage = () => {
      const savedState = localStorage.getItem("sidebar-collapsed");
      if (savedState !== null) {
        const parsedState = JSON.parse(savedState);
        if (parsedState !== isSidebarCollapsed) {
          setIsSidebarCollapsed(parsedState);
        }
      }
    };
    
    const interval = setInterval(checkLocalStorage, 500);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [isSidebarCollapsed]);

  return (
    <div className="flex min-h-screen">
      <div className={`flex-1 transition-all duration-300 ${
        isSidebarCollapsed ? 'md:ml-[70px]' : 'md:ml-[240px]'
      }`}>
        <div className="py-6 px-4 sticky top-0 bg-background z-10">
          <Header />
        </div>
        
        <div className="container mx-auto py-8 px-4 max-w-3xl">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-primary">OnePage</h1>
            <Button variant="outline" asChild>
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Tasks
              </Link>
            </Button>
          </div>

          <div className="bg-card p-6 rounded-lg mb-8">
            <h2 className="text-2xl font-semibold mb-4">About OnePage</h2>
            <p className="text-muted-foreground mb-4">
              OnePage is a minimalist task management application designed to keep all your tasks organized in a single view.
              No more switching between different pages or views - everything you need is available at a glance.
            </p>
            <p className="text-muted-foreground">
              Built with React, TypeScript, and Express, OnePage offers a dark-themed interface for comfortable extended use.
            </p>
          </div>

          <div className="bg-card p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-6">How to Use</h2>
            
            <div className="space-y-6">
              <div className="flex items-start">
                <div className="bg-primary/20 p-2 rounded mr-4">
                  <CheckCircle className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-1">Managing Tasks</h3>
                  <p className="text-muted-foreground">
                    Add new tasks using the input fields at the bottom of each section. Check the checkbox to mark tasks as complete.
                    Click "Archive Completed" to move completed tasks to the archive.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="bg-primary/20 p-2 rounded mr-4">
                  <MousePointerClick className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-1">Moving Tasks</h3>
                  <p className="text-muted-foreground">
                    Click the up arrow to move a task to the "Today" section. Use the down arrow to move it back to its original category.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="bg-primary/20 p-2 rounded mr-4">
                  <Keyboard className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-1">Keyboard Shortcuts</h3>
                  <p className="text-muted-foreground">
                    Press <span className="bg-muted px-2 py-0.5 rounded">Tab</span> when focused on a task to indent it.
                    Use <span className="bg-muted px-2 py-0.5 rounded">Shift + Tab</span> to unindent.
                    This creates visual hierarchies for your tasks.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="bg-primary/20 p-2 rounded mr-4">
                  <Clipboard className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-1">Quick Task Creation</h3>
                  <p className="text-muted-foreground">
                    Press Enter after adding a task to quickly focus the input field again, allowing for rapid sequential task entry.
                    Perfect for quickly capturing a list of to-dos.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="bg-primary/20 p-2 rounded mr-4">
                  <Edit3 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-1">Editing Categories</h3>
                  <p className="text-muted-foreground">
                    Hover over any category name to reveal an edit icon. Click it to rename the category to better organize your tasks.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="bg-primary/20 p-2 rounded mr-4">
                  <GripHorizontal className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-1">Drag and Drop</h3>
                  <p className="text-muted-foreground">
                    Click and drag tasks to move them between categories or reorder them within a category.
                    Look for the grip handle that appears when you hover over a task.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="bg-primary/20 p-2 rounded mr-4">
                  <Repeat className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-1">Repeating Tasks</h3>
                  <p className="text-muted-foreground">
                    Click the arrow button on any task and select "Set up repeating task" to create tasks that automatically recur. 
                    You can set tasks to repeat daily, weekly, monthly, or quarterly, and they'll be recreated at 7:00 AM on their scheduled day.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center text-muted-foreground">
            <Button variant="link" asChild>
              <Link href="/">Return to your tasks</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}