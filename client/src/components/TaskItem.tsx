import { useState, KeyboardEvent, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Task } from "@shared/schema";
import { ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDraggable } from "@dnd-kit/core";

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
  
  // Set up draggable
  const { 
    setNodeRef, 
    transform, 
    isDragging,
    attributes,
    listeners
  } = useDraggable({
    id: `task-${task.id}`,
    data: {
      type: 'task',
      task,
      sourceSection: inTodaySection ? 'today' : 'category'
    }
  });

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

  const indentTaskMutation = useMutation({
    mutationFn: (increase: boolean) => {
      return apiRequest("PATCH", `/api/tasks/${task.id}/indent`, { increase })
        .then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
    }
  });

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      
      if (e.shiftKey) {
        // Shift+Tab: Decrease indentation
        if (task.indentLevel && task.indentLevel > 0) {
          indentTaskMutation.mutate(false);
        }
      } else {
        // Tab: Increase indentation or create subtask if already fully indented
        if (task.indentLevel < 3) { // Limit indentation to 3 levels
          indentTaskMutation.mutate(true);
        } else if (onCreateSubtask) {
          // If we've reached max indentation, create a subtask instead
          onCreateSubtask(task.id);
        }
      }
    }
  };

  // Determine indentation level class
  const indentClass = task.indentLevel > 0 ? `task-indent-${task.indentLevel}` : '';

  const dragStyle = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 999
  } : undefined;

  return (
    <div 
      ref={setNodeRef}
      style={dragStyle}
      className={cn(
        "task-item flex items-center rounded-md cursor-grab",
        indentClass,
        updateTaskMutation.isPending && "opacity-70",
        isDragging && "opacity-50 bg-muted"
      )}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Handle for dragging */}
      <button 
        className="drag-handle opacity-0 group-hover:opacity-70 mr-1 cursor-grab flex items-center p-1 hover:bg-muted rounded"
        title="Drag to move"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      
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
        <span className={cn("text-xs text-muted-foreground mr-3", task.completed && "opacity-50")}>
          {task.originalCategory}
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
