import { useState, KeyboardEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Task } from "@shared/schema";
import TaskItem from "./TaskItem";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface TodaySectionProps {
  tasks: Task[];
}

export default function TodaySection({ tasks }: TodaySectionProps) {
  const [newTaskText, setNewTaskText] = useState("");

  const todayTasks = tasks.filter(task => task.inTodaySection);
  
  const addTaskMutation = useMutation({
    mutationFn: (text: string) => {
      return apiRequest("POST", "/api/tasks", {
        text,
        inTodaySection: true
      }).then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
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
          Today
          <Badge variant="outline" className="ml-2 bg-primary bg-opacity-20 text-primary">
            {todayTasks.length}
          </Badge>
        </h2>
      </div>

      <div className="space-y-2">
        {todayTasks.map(task => (
          <TaskItem 
            key={task.id} 
            task={task} 
            inTodaySection={true}
          />
        ))}
        
        <div className="mt-3">
          <Input
            type="text"
            placeholder="Add a task for today..."
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
