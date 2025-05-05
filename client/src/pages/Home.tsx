import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import TodaySection from "@/components/TodaySection";
import CategorySection from "@/components/CategorySection";
import { Button } from "@/components/ui/button";
import { PlusIcon, Settings, Archive } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Home() {
  const [isAddCategoryDialogOpen, setIsAddCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["/api/tasks"]
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
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

  return (
    <div className="container mx-auto px-4 sm:px-6 max-w-3xl min-h-screen">
      <header className="py-6 sticky top-0 bg-background z-10">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-primary">OnePage</h1>
          <Button variant="ghost" size="icon">
            <Settings className="h-6 w-6 text-muted-foreground hover:text-primary" />
          </Button>
        </div>
      </header>

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
              <Archive className="h-5 w-5 mr-2" />
              View Archived Tasks
            </Button>
          </Link>
        </div>
      </main>

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
