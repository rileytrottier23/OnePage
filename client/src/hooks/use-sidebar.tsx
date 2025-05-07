import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

type SidebarContextType = {
  isExpanded: boolean;
  toggleSidebar: () => void;
  isMobile: boolean;
};

const SidebarContext = createContext<SidebarContextType | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const isMobile = useIsMobile();
  
  // On mobile devices, sidebar is always collapsed
  useEffect(() => {
    if (isMobile) {
      setIsExpanded(false);
    }
  }, [isMobile]);
  
  // Handle window resize event to collapse sidebar on narrow screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsExpanded(false);
      }
    };
    
    // Check initial window size
    handleResize();
    
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  
  // Try to load from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem("sidebar-expanded");
    if (savedState !== null && !isMobile) {
      setIsExpanded(savedState === "true");
    }
  }, [isMobile]);
  
  // Save to localStorage when changed
  useEffect(() => {
    localStorage.setItem("sidebar-expanded", isExpanded.toString());
  }, [isExpanded]);
  
  const toggleSidebar = () => {
    setIsExpanded(prev => !prev);
  };
  
  return (
    <SidebarContext.Provider value={{ isExpanded, toggleSidebar, isMobile }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}