import { useState, KeyboardEvent, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Task } from "@shared/schema";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskItemProps {
  task: Task;
  inTodaySection?: boolean;
  categoryName?: string;
  onCreateSubtask?: (taskId: number) => void;
  focusRef?: React.RefObject<HTMLDivElement>;
}

export default function TaskItem({ 
  task, 
  inTodaySection = false, 
  categoryName,
  onCreateSubtask,
  focusRef
}: TaskItemProps) {
  const [isChecked, setIsChecked] = useState(task.completed);
  const taskRef = useRef<HTMLDivElement>(null);

  const updateTaskMutation = useMutation({
    mutationFn: (updatedTask: Partial<Task>) => {
      return apiRequest("PATCH", `/api/tasks/${task.id}`, updatedTask)
        .then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
    }
  });

  const moveTaskMutation = useMutation({
    mutationFn: (moveToToday: boolean) => {
      return apiRequest("PATCH", `/api/tasks/${task.id}/move`, { 
        moveToToday 
      }).then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
    }
  });

  const handleCheckboxChange = (checked: boolean) => {
    setIsChecked(checked);
    updateTaskMutation.mutate({ completed: checked });
  };

  const handleMoveTask = () => {
    moveTaskMutation.mutate(!inTodaySection);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Create subtask when Tab is pressed
    if (e.key === 'Tab' && !e.shiftKey && onCreateSubtask) {
      e.preventDefault();
      onCreateSubtask(task.id);
    }
  };

  // Determine indentation level class
  const indentClass = task.indentLevel > 0 ? `task-indent-${task.indentLevel}` : '';

  return (
    <div 
      ref={focusRef || taskRef}
      className={cn(
        "task-item flex items-center rounded-md",
        indentClass,
        updateTaskMutation.isPending && "opacity-70"
      )}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <Checkbox 
        className="h-5 w-5 rounded border-gray-600 mr-3"
        checked={isChecked} 
        onCheckedChange={handleCheckboxChange}
        disabled={updateTaskMutation.isPending || moveTaskMutation.isPending}
      />
      <span className={cn("flex-grow flex items-center", task.completed && "completed-task")}>
        {task.indentLevel > 0 && (
          <span className="subtask-indicator"></span>
        )}
        {task.text}
      </span>
      
      {inTodaySection && task.originalCategory && (
        <span className={cn("category-tag mr-3", task.completed && "opacity-50")}>
          From: {task.originalCategory}
        </span>
      )}
      
      <button 
        className="text-muted-foreground hover:text-primary"
        onClick={handleMoveTask}
        disabled={updateTaskMutation.isPending || moveTaskMutation.isPending}
        aria-label={inTodaySection ? "Move back to original category" : "Move to Today"}
      >
        {inTodaySection ? (
          <ChevronDown className="h-5 w-5" />
        ) : (
          <ChevronUp className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}
