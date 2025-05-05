import { useState, KeyboardEvent, useRef } from "react";
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
  const [newSubtaskId, setNewSubtaskId] = useState<number | null>(null);
  const newSubtaskRef = useRef<HTMLDivElement>(null);

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

  const createSubtaskMutation = useMutation({
    mutationFn: ({ parentId, text }: { parentId: number, text: string }) => {
      return apiRequest("POST", `/api/tasks/${parentId}/subtask`, { text })
        .then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setNewSubtaskId(null);
    }
  });

  const handleAddTask = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && newTaskText.trim() !== "") {
      // Handle multi-line paste - split by newline characters
      const lines = newTaskText.trim().split(/\r?\n/).filter(line => line.trim() !== "");
      
      if (lines.length > 1) {
        // Multiple lines detected - create multiple tasks
        lines.forEach(line => {
          addTaskMutation.mutate(line.trim());
        });
      } else {
        // Single line - create a single task
        addTaskMutation.mutate(newTaskText.trim());
      }
    }
  };

  const handleCreateSubtask = (parentId: number) => {
    setNewSubtaskId(parentId);
    // Focus will be handled after render via the ref
    setTimeout(() => {
      if (newSubtaskRef.current) {
        newSubtaskRef.current.focus();
      }
    }, 0);
  };

  // Group tasks by their hierarchy
  const organizeTasks = () => {
    // First, organize tasks by parent-child relationship
    const rootTasks = todayTasks.filter(task => !task.parentTaskId);
    const taskMap = new Map<number, Task[]>();
    
    // Create a map of parent to children
    todayTasks.forEach(task => {
      if (task.parentTaskId) {
        const children = taskMap.get(task.parentTaskId) || [];
        children.push(task);
        taskMap.set(task.parentTaskId, children);
      }
    });

    // Helper function to render a task and its children
    const renderTaskHierarchy = (task: Task): JSX.Element[] => {
      const result: JSX.Element[] = [
        <TaskItem 
          key={task.id} 
          task={task} 
          inTodaySection={true}
          onCreateSubtask={handleCreateSubtask}
          focusRef={newSubtaskId === task.id ? newSubtaskRef : undefined}
        />
      ];
      
      // Add children (if any)
      const children = taskMap.get(task.id) || [];
      children.forEach(child => {
        result.push(...renderTaskHierarchy(child));
      });
      
      return result;
    };
    
    // Render all root tasks and their children
    return rootTasks.flatMap(renderTaskHierarchy);
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

      <div className="tasks-container">
        {organizeTasks()}
        
        <div className="mt-3">
          <Input
            type="text"
            placeholder="Add a task for today..."
            className="add-task-input w-full px-3 py-2 text-foreground"
            value={newTaskText}
            onChange={e => {
              // Check if this is a paste event with multiple lines
              if (e.target.value.includes('\n')) {
                const lines = e.target.value.split(/\r?\n/).filter(line => line.trim() !== "");
                
                // Process multi-line input
                lines.forEach(line => {
                  addTaskMutation.mutate(line.trim());
                });
                
                // Clear the input after processing
                setNewTaskText("");
              } else {
                setNewTaskText(e.target.value);
              }
            }}
            onKeyUp={handleAddTask}
            disabled={addTaskMutation.isPending}
          />
        </div>
      </div>
    </section>
  );
}
