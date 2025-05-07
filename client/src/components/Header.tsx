import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Archive, CheckCheck, ChevronLeft, ChevronRight, LogOut, Mail, Menu, Repeat, Settings, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function Header() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    // Check localStorage for saved preference, default to false (expanded)
    const savedState = localStorage.getItem("sidebar-collapsed");
    return savedState ? JSON.parse(savedState) : false;
  });
  
  // Save sidebar state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);
  
  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => !prev);
  };
  
  const showArchiveLink = location === '/dashboard' || location === '/archive';
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Get user initials for avatar
  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };
  
  return (
    <div className="flex justify-between items-center mb-4 px-2">
      <div className="flex items-center">
        {/* Make logo 30% larger */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <CheckCheck className="h-9 w-9 text-primary" /> {/* Increased from h-7 w-7 */}
          <h1 className="text-3xl font-bold text-primary hover:text-primary/90 transition-colors">OnePage</h1> {/* Increased from text-2xl */}
        </Link>
        <span className="text-xs text-muted-foreground ml-1">Task Management</span>
      </div>
      
      {/* Mobile menu trigger */}
      <Sheet>
        <SheetTrigger asChild className="md:hidden">
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[240px] sm:w-[280px]">
          <div className="flex flex-col h-full py-4">
            <div className="mb-8 flex items-center">
              <h2 className="text-xl font-bold">Menu</h2>
            </div>
            
            <div className="space-y-4">
              <Link href="/dashboard" className={cn(
                "flex items-center py-2 px-3 rounded-md transition-colors",
                location === '/dashboard' ? "bg-primary/10 text-primary" : "hover:bg-muted"
              )}>
                <CheckCheck className="h-5 w-5 mr-3" />
                <span>Tasks</span>
              </Link>

              {showArchiveLink && (
                <Link href="/archive" className={cn(
                  "flex items-center py-2 px-3 rounded-md transition-colors",
                  location === '/archive' ? "bg-primary/10 text-primary" : "hover:bg-muted"
                )}>
                  <Archive className="h-5 w-5 mr-3" />
                  <span>Archive</span>
                </Link>
              )}

              <Link href="/repeating" className={cn(
                "flex items-center py-2 px-3 rounded-md transition-colors",
                location === '/repeating' ? "bg-primary/10 text-primary" : "hover:bg-muted"
              )}>
                <Repeat className="h-5 w-5 mr-3" />
                <span>Repeating</span>
              </Link>

              <Link href="/about" className={cn(
                "flex items-center py-2 px-3 rounded-md transition-colors",
                location === '/about' ? "bg-primary/10 text-primary" : "hover:bg-muted"
              )}>
                <Settings className="h-5 w-5 mr-3" />
                <span>Features</span>
              </Link>
              
              <Link href="/contact" className={cn(
                "flex items-center py-2 px-3 rounded-md transition-colors",
                location === '/contact' ? "bg-primary/10 text-primary" : "hover:bg-muted"
              )}>
                <Mail className="h-5 w-5 mr-3" />
                <span>Contact</span>
              </Link>
            </div>
            
            <div className="mt-auto">
              {user && (
                <div className="border-t border-border pt-4">
                  <div className="flex items-center p-2 mb-2">
                    <Avatar className="h-8 w-8 mr-3">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials(user.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user.username}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[180px]">{user.email}</p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={handleLogout}
                    disabled={logoutMutation.isPending}
                  >
                    {logoutMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        <span>Logging out...</span>
                      </>
                    ) : (
                      <>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
      
      {/* Desktop side menu - hidden on mobile */}
      <div 
        className={cn(
          "hidden md:flex fixed left-0 top-0 h-screen border-r border-border bg-background z-40 flex-col p-4 transition-all duration-300",
          isSidebarCollapsed ? "w-[70px]" : "w-[240px]"
        )}
      >
        <div className="flex justify-end mb-6 mt-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8" 
                  onClick={toggleSidebar}
                >
                  {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        <div className="space-y-4">
          <TooltipProvider>
            <Link href="/dashboard" className={cn(
              "flex items-center py-2 px-3 rounded-md transition-colors",
              location === '/dashboard' ? "bg-primary/10 text-primary" : "hover:bg-muted"
            )}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={isSidebarCollapsed ? "mx-auto" : "mr-3"}>
                    <CheckCheck className="h-5 w-5" />
                  </div>
                </TooltipTrigger>
                {isSidebarCollapsed && <TooltipContent side="right">Tasks</TooltipContent>}
              </Tooltip>
              {!isSidebarCollapsed && <span>Tasks</span>}
            </Link>

            {showArchiveLink && (
              <Link href="/archive" className={cn(
                "flex items-center py-2 px-3 rounded-md transition-colors",
                location === '/archive' ? "bg-primary/10 text-primary" : "hover:bg-muted"
              )}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={isSidebarCollapsed ? "mx-auto" : "mr-3"}>
                      <Archive className="h-5 w-5" />
                    </div>
                  </TooltipTrigger>
                  {isSidebarCollapsed && <TooltipContent side="right">Archive</TooltipContent>}
                </Tooltip>
                {!isSidebarCollapsed && <span>Archive</span>}
              </Link>
            )}

            <Link href="/repeating" className={cn(
              "flex items-center py-2 px-3 rounded-md transition-colors",
              location === '/repeating' ? "bg-primary/10 text-primary" : "hover:bg-muted"
            )}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={isSidebarCollapsed ? "mx-auto" : "mr-3"}>
                    <Repeat className="h-5 w-5" />
                  </div>
                </TooltipTrigger>
                {isSidebarCollapsed && <TooltipContent side="right">Repeating</TooltipContent>}
              </Tooltip>
              {!isSidebarCollapsed && <span>Repeating</span>}
            </Link>

            <Link href="/about" className={cn(
              "flex items-center py-2 px-3 rounded-md transition-colors",
              location === '/about' ? "bg-primary/10 text-primary" : "hover:bg-muted"
            )}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={isSidebarCollapsed ? "mx-auto" : "mr-3"}>
                    <Settings className="h-5 w-5" />
                  </div>
                </TooltipTrigger>
                {isSidebarCollapsed && <TooltipContent side="right">Features</TooltipContent>}
              </Tooltip>
              {!isSidebarCollapsed && <span>Features</span>}
            </Link>
            
            <Link href="/contact" className={cn(
              "flex items-center py-2 px-3 rounded-md transition-colors",
              location === '/contact' ? "bg-primary/10 text-primary" : "hover:bg-muted"
            )}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={isSidebarCollapsed ? "mx-auto" : "mr-3"}>
                    <Mail className="h-5 w-5" />
                  </div>
                </TooltipTrigger>
                {isSidebarCollapsed && <TooltipContent side="right">Contact</TooltipContent>}
              </Tooltip>
              {!isSidebarCollapsed && <span>Contact</span>}
            </Link>
          </TooltipProvider>
        </div>
        
        <div className="mt-auto mb-4">
          {user && (
            <div className="border-t border-border pt-4">
              {!isSidebarCollapsed ? (
                <>
                  <div className="flex items-center p-2 mb-2">
                    <Avatar className="h-8 w-8 mr-3">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials(user.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user.username}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[180px]">{user.email}</p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={handleLogout}
                    disabled={logoutMutation.isPending}
                  >
                    {logoutMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        <span>Logging out...</span>
                      </>
                    ) : (
                      <>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 rounded-full mx-auto block"
                        onClick={handleLogout}
                        disabled={logoutMutation.isPending}
                      >
                        {logoutMutation.isPending ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <LogOut className="h-5 w-5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Log out</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Only show this on desktop viewport */}
      <div className="hidden md:block ml-auto">
        {/* This is an empty div to maintain the header's space between layout with the sidebar */}
      </div>
    </div>
  );
}