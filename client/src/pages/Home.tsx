import { useState } from "react";
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
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { Task, Category } from "@shared/schema";

export default function Home() {
  const [isAddCategoryDialogOpen, setIsAddCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"]
  });

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

  // Handle drag end for moving tasks between categories
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;
    
    // Extract the data from the active and over elements
    const activeData = active.data.current;
    const overData = over.data.current;
    
    if (
      activeData?.type === 'task' && 
      overData?.type === 'category' && 
      activeData.task.categoryId !== overData.categoryId
    ) {
      // Move task to a different category
      moveTaskMutation.mutate({
        taskId: activeData.task.id,
        categoryId: overData.categoryId
      });
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Main content area - shifted to right to make room for side menu on desktop */}
      <div className="flex-1 md:ml-[240px]">
        <div className="py-6 px-4 sticky top-0 bg-background z-10">
          <Header />
        </div>

        <div className="px-4 md:px-6 max-w-3xl mx-auto pb-16">
          <DndContext 
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <main>
              <TodaySection tasks={tasks} />

              {categories.map(category => (
                <CategorySection 
                  key={category.id} 
                  category={category} 
                  tasks={tasks.filter(task => task.categoryId === category.id)}
                />
              ))}

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
