import { useState, KeyboardEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Task, Category } from "@shared/schema";
import TaskItem from "./TaskItem";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface CategorySectionProps {
  category: Category;
  tasks: Task[];
}

export default function CategorySection({ category, tasks }: CategorySectionProps) {
  const [newTaskText, setNewTaskText] = useState("");

  const activeTasks = tasks.filter(task => !task.inTodaySection);
  
  const addTaskMutation = useMutation({
    mutationFn: (text: string) => {
      return apiRequest("POST", "/api/tasks", {
        text,
        categoryId: category.id
      }).then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setNewTaskText("");
    }
  });

  const handleAddTask = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && newTaskText.trim() !== "") {
      addTaskMutation.mutate(newTaskText.trim());
    }
  };

  return (
    <section className="mb-6 category-container p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl font-semibold flex items-center">
          {category.name}
          <Badge variant="outline" className="ml-2 bg-primary bg-opacity-20 text-primary">
            {activeTasks.length}
          </Badge>
        </h2>
      </div>

      <div className="space-y-2">
        {activeTasks.map(task => (
          <TaskItem 
            key={task.id} 
            task={task} 
            categoryName={category.name}
          />
        ))}
        
        <div className="mt-3">
          <Input
            type="text"
            placeholder={`Add a ${category.name.toLowerCase()} task...`}
            className="add-task-input w-full px-3 py-2 text-foreground"
            value={newTaskText}
            onChange={e => setNewTaskText(e.target.value)}
            onKeyUp={handleAddTask}
            disabled={addTaskMutation.isPending}
          />
        </div>
      </div>
    </section>
  );
}
