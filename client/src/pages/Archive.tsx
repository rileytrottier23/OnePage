import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export default function Archive() {
  const { data: archivedTasks = [], isLoading } = useQuery({
    queryKey: ["/api/tasks/archived"]
  });

  // Group tasks by completion date
  const groupedTasks = archivedTasks.reduce((acc, task) => {
    const completedDate = new Date(task.completedAt);
    const dateStr = formatDate(completedDate);
    
    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }
    
    acc[dateStr].push(task);
    return acc;
  }, {});

  // Sort dates in reverse chronological order
  const sortedDates = Object.keys(groupedTasks).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime();
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 max-w-3xl py-6">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-card rounded"></div>
          <div className="h-60 bg-card rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 max-w-3xl min-h-screen">
      <header className="py-6 sticky top-0 bg-background z-10">
        <div className="flex items-center">
          <Link href="/">
            <Button variant="ghost" size="icon" className="mr-2">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-semibold text-primary">Archived Tasks</h1>
        </div>
      </header>

      <main>
        {archivedTasks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No archived tasks yet.</p>
          </div>
        ) : (
          <div>
            {sortedDates.map(date => (
              <section key={date} className="mb-6 category-container p-4">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-xl font-semibold flex items-center">
                    {date}
                    <Badge variant="outline" className="ml-2 bg-primary bg-opacity-20 text-primary">
                      {groupedTasks[date].length}
                    </Badge>
                  </h2>
                </div>
                
                <div className="space-y-2">
                  {groupedTasks[date].map(task => (
                    <div key={task.id} className="task-item flex items-center p-2 rounded-md">
                      <Checkbox 
                        className="h-5 w-5 rounded border-gray-600 mr-3"
                        checked={true} 
                        disabled
                      />
                      <span className="flex-grow completed-task">
                        {task.text}
                      </span>
                      {task.originalCategory && (
                        <span className="category-tag opacity-50 mr-3">
                          From: {task.originalCategory}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="text-center mb-6">
          <Link href="/">
            <Button className="text-primary inline-flex items-center">
              <ChevronLeft className="h-5 w-5 mr-2" />
              Back to Tasks
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
