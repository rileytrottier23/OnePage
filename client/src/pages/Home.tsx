import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import TodaySection from "@/components/TodaySection";
import CategorySection from "@/components/CategorySection";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { PlusIcon, Settings, Archive as ArchiveIcon, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DndContext, closestCenter, pointerWithin, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task, Category } from "@shared/schema";

export default function Home() {
  const [isAddCategoryDialogOpen, setIsAddCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
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
    
    // Create a custom event listener for direct updates in the same window
    const handleCustomEvent = (e: StorageEvent) => {
      if (e.key === "sidebar-collapsed") {
        setIsSidebarCollapsed(e.newValue ? JSON.parse(e.newValue) : false);
      }
    };
    
    // Set up a MutationObserver to listen for sidebar-collapsed changes
    const checkLocalStorage = () => {
      const savedState = localStorage.getItem("sidebar-collapsed");
      if (savedState !== null) {
        const parsedState = JSON.parse(savedState);
        if (parsedState !== isSidebarCollapsed) {
          setIsSidebarCollapsed(parsedState);
        }
      }
    };
    
    // Check periodically (not ideal but works as a fallback)
    const interval = setInterval(checkLocalStorage, 500);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [isSidebarCollapsed]);

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"]
  });
  
  // Create a reference to tasks for use in drag and drop operations
  const allTasks = tasks;

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"]
  });

  const addCategoryMutation = useMutation({
    mutationFn: (name: string) => {
      return apiRequest("POST", "/api/categories", { name })
        .then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setIsAddCategoryDialogOpen(false);
      setNewCategoryName("");
    }
  });
  
  // Move task to a different category
  const moveTaskMutation = useMutation({
    mutationFn: ({ taskId, categoryId }: { taskId: number, categoryId: number }) => {
      return apiRequest("PATCH", `/api/tasks/${taskId}/category`, { categoryId })
        .then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    }
  });
  
  // Archive completed tasks
  const archiveCompletedTasksMutation = useMutation({
    mutationFn: () => {
      return apiRequest("POST", `/api/tasks/archive`)
        .then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    }
  });

  const handleAddCategory = () => {
    if (newCategoryName.trim() !== "") {
      addCategoryMutation.mutate(newCategoryName.trim());
    }
  };

  if (tasksLoading || categoriesLoading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 max-w-3xl py-6">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-card rounded"></div>
          <div className="h-60 bg-card rounded"></div>
          <div className="h-60 bg-card rounded"></div>
        </div>
      </div>
    );
  }

  // Mutation for reordering tasks
  const reorderTaskMutation = useMutation({
    mutationFn: ({ taskId, targetTaskId, position }: { taskId: number, targetTaskId: number, position: 'before' | 'after' }) => {
      return apiRequest("PATCH", `/api/tasks/${taskId}/reorder`, { 
        targetTaskId,
        position
      }).then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    }
  });

  // Handle drag end for moving tasks between categories or reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;
    
    // Extract the data from the active and over elements
    const activeData = active.data.current;
    const overData = over.data.current;
    
    // Case 1: Move task to a different category
    if (
      activeData?.type === 'task' && 
      overData?.type === 'category' && 
      activeData.task.categoryId !== overData.categoryId
    ) {
      moveTaskMutation.mutate({
        taskId: activeData.task.id,
        categoryId: overData.categoryId
      });
    }
    
    // Case 2: Reorder tasks within the same category or today section
    else if (
      activeData?.type === 'task' &&
      overData?.type === 'task' &&
      activeData.task.id !== overData.task.id
    ) {
      // Check if both tasks are in the same section (today or same category)
      const sameSection = 
        (activeData.sourceSection === 'today' && overData.sourceSection === 'today') ||
        (activeData.sourceSection === 'category' && 
         overData.sourceSection === 'category' && 
         activeData.task.categoryId === overData.task.categoryId);
         
      if (sameSection) {
        // Determine if we're placing before or after the target task
        const activeIndex = allTasks.findIndex((t: Task) => t.id === activeData.task.id);
        const overIndex = allTasks.findIndex((t: Task) => t.id === overData.task.id);
        
        reorderTaskMutation.mutate({
          taskId: activeData.task.id,
          targetTaskId: overData.task.id,
          position: activeIndex > overIndex ? 'before' : 'after'
        });
      }
    }
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

        <div className="px-4 md:px-6 max-w-3xl mx-auto pb-16">
          <DndContext 
            collisionDetection={pointerWithin}
            onDragEnd={handleDragEnd}
          >
            <main>
              {/* Today Section */}
              <SortableContext 
                items={tasks.filter(t => t.inTodaySection).map(t => `task-${t.id}`)}
                strategy={verticalListSortingStrategy}
              >
                <TodaySection tasks={tasks} />
              </SortableContext>

              {/* Category Sections */}
              {categories.map(category => {
                const categoryTasks = tasks.filter(task => 
                  task.categoryId === category.id && !task.inTodaySection
                );
                
                return (
                  <SortableContext
                    key={category.id}
                    items={categoryTasks.map(t => `task-${t.id}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    <CategorySection 
                      key={category.id} 
                      category={category} 
                      tasks={categoryTasks}
                    />
                  </SortableContext>
                );
              })}

              <Button 
                className="w-full py-3 px-4 bg-card hover:bg-opacity-90 rounded-md flex items-center justify-center text-primary mb-6"
                variant="ghost"
                onClick={() => setIsAddCategoryDialogOpen(true)}
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Add New Category
              </Button>

              <div className="text-center mb-6">
                <Link href="/archive">
                  <Button variant="ghost" className="text-muted-foreground hover:text-primary inline-flex items-center">
                    <ArchiveIcon className="h-5 w-5 mr-2" />
                    View Archived Tasks
                  </Button>
                </Link>
              </div>
            </main>
          </DndContext>
        </div>
      </div>

      <Dialog open={isAddCategoryDialogOpen} onOpenChange={setIsAddCategoryDialogOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">Category Name</Label>
              <Input 
                id="name" 
                placeholder="Enter category name" 
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsAddCategoryDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddCategory}
              disabled={addCategoryMutation.isPending || newCategoryName.trim() === ""}
            >
              Add Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
