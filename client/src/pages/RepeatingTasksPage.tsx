import { useState, useEffect } from "react";
import Header from "@/components/Header";
import RepeatingTasksTable from "@/components/RepeatingTasksTable";

export default function RepeatingTasksPage() {
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
      {/* Main content area - shifted to right to make room for side menu on desktop */}
      <div className={`flex-1 transition-all duration-300 ${
        isSidebarCollapsed ? 'md:ml-[70px]' : 'md:ml-[240px]'
      }`}>
        <div className="py-6 px-4 sticky top-0 bg-background z-10">
          <Header />
        </div>

        <div className="px-4 md:px-6 max-w-5xl mx-auto pb-16">
          <div className="flex items-center mb-6">
            <h1 className="text-2xl font-semibold text-primary">Repeating Tasks</h1>
          </div>

          <div className="bg-card p-6 rounded-lg shadow-sm">
            <RepeatingTasksTable />
          </div>
        </div>
      </div>
    </div>
  );
}