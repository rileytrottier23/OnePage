import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Archive, HelpCircle, LogOut, Mail, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";

export default function Header() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  
  const showArchiveLink = location === '/' || location === '/archive';
  
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
        <Link href="/">
          <h1 className="text-xl font-bold text-primary mr-2 hover:text-primary/90 transition-colors">OnePage</h1>
        </Link>
        <span className="text-xs text-muted-foreground">Task Management</span>
      </div>
      
      <div className="flex items-center space-x-4">
        <Link href="/about" className={cn(
          "flex items-center text-muted-foreground hover:text-primary transition-colors",
          "text-sm"
        )}>
          <HelpCircle className="h-4 w-4 mr-1" />
          <span>Help</span>
        </Link>
        
        <Link href="/contact" className={cn(
          "flex items-center text-muted-foreground hover:text-primary transition-colors",
          "text-sm"
        )}>
          <Mail className="h-4 w-4 mr-1" />
          <span>Contact</span>
        </Link>
        
        {showArchiveLink && (
          <Link href="/archive" className={cn(
            "flex items-center text-muted-foreground hover:text-primary transition-colors",
            "text-sm"
          )}>
            <Archive className="h-4 w-4 mr-1" />
            <span>Archive</span>
          </Link>
        )}

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getInitials(user.username)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="flex items-center justify-start gap-2 p-2">
                <div className="flex flex-col space-y-1 leading-none">
                  <p className="font-medium">{user.username}</p>
                  <p className="text-xs text-muted-foreground overflow-hidden text-ellipsis w-[200px]">
                    {user.email}
                  </p>
                </div>
              </div>
              <DropdownMenuItem onClick={handleLogout} disabled={logoutMutation.isPending}>
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
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}