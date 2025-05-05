import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Archive, HelpCircle } from "lucide-react";

export default function Header() {
  const [location] = useLocation();
  
  // Only show the header on the main page
  if (location !== '/') return null;
  
  return (
    <div className="flex justify-between items-center mb-4 px-2">
      <div className="flex items-center">
        <h1 className="text-xl font-bold text-primary mr-2">OnePage</h1>
        <span className="text-xs text-muted-foreground">Task Management</span>
      </div>
      
      <div className="flex space-x-4">
        <Link href="/about" className={cn(
          "flex items-center text-muted-foreground hover:text-primary transition-colors",
          "text-sm"
        )}>
          <HelpCircle className="h-4 w-4 mr-1" />
          <span>Help</span>
        </Link>
        
        <Link href="/archive" className={cn(
          "flex items-center text-muted-foreground hover:text-primary transition-colors",
          "text-sm"
        )}>
          <Archive className="h-4 w-4 mr-1" />
          <span>Archive</span>
        </Link>
      </div>
    </div>
  );
}