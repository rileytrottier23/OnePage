import { useState, KeyboardEvent, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Task, Category } from "@shared/schema";
import { ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDraggable } from "@dnd-kit/core";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";

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

  const changeCategoryMutation = useMutation({
    mutationFn: (categoryId: number) => {
      if (categoryId === null || categoryId === undefined) {
        return Promise.reject(new Error("Invalid category ID"));
      }
      return apiRequest("PATCH", `/api/tasks/${task.id}/category`, { 
        categoryId 
      }).then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
    }
  });

  // Fetch categories for the dropdown
  const { data: categories = [] } = useQuery<Category[]>({ 
    queryKey: ["/api/categories"],
  });

  const [open, setOpen] = useState(false);

  const handleCheckboxChange = (checked: boolean) => {
    setIsChecked(checked);
    updateTaskMutation.mutate({ completed: checked });
  };

  const handleMoveTask = () => {
    // Always open the category selection dropdown
    setOpen(true);
  };

  const handleSelectCategory = (categoryId: number | null) => {
    if (categoryId === null) return;
    
    if (categoryId === task.categoryId) {
      // Move to Today section instead
      moveTaskMutation.mutate(true);
    } else {
      // Move to different category
      changeCategoryMutation.mutate(categoryId);
    }
    setOpen(false);
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
      // Prevent default Tab behavior (moving focus)
      e.preventDefault();
      e.stopPropagation();
      
      // Debug output
      console.log(`Tab pressed on task ${task.id}, current indent: ${task.indentLevel || 0}`);
      
      if (e.shiftKey) {
        // Shift+Tab: Decrease indentation
        if ((task.indentLevel || 0) > 0) {
          console.log(`Decreasing indent for task ${task.id}`);
          indentTaskMutation.mutate(false);
        }
      } else {
        // Tab: Increase indentation
        // Limit indentation to 3 levels
        const currentIndent = task.indentLevel || 0;
        if (currentIndent < 3) {
          console.log(`Increasing indent for task ${task.id}`);
          indentTaskMutation.mutate(true);
        } else if (onCreateSubtask) {
          // If we've reached max indentation, create a subtask instead
          console.log(`Max indent reached, creating subtask for ${task.id}`);
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
        "task-item flex items-center rounded-md cursor-grab relative",
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
      
      {inTodaySection ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button 
              className="text-muted-foreground hover:text-primary"
              onClick={handleMoveTask}
              disabled={updateTaskMutation.isPending || moveTaskMutation.isPending}
              aria-label="Move task to category"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-48" align="end" side="bottom">
            <Command>
              <CommandInput placeholder="Search categories..." />
              <CommandEmpty>No categories found</CommandEmpty>
              <CommandGroup heading="Move to">
                {task.originalCategory && (
                  <CommandItem 
                    onSelect={() => moveTaskMutation.mutate(false)}
                    className="font-medium"
                  >
                    {`Back to ${task.originalCategory}`}
                  </CommandItem>
                )}
                {categories.map((category) => (
                  <CommandItem
                    key={category.id}
                    onSelect={() => handleSelectCategory(category.id)}
                    disabled={category.id === task.categoryId}
                    className={category.id === task.categoryId ? "opacity-50" : ""}
                  >
                    {category.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button 
              className="text-muted-foreground hover:text-primary"
              onClick={handleMoveTask}
              disabled={updateTaskMutation.isPending || moveTaskMutation.isPending}
              aria-label="Move task to category"
            >
              <ChevronUp className="h-5 w-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-48" align="end" side="top">
            <Command>
              <CommandInput placeholder="Search categories..." />
              <CommandEmpty>No categories found</CommandEmpty>
              <CommandGroup heading="Move to">
                <CommandItem 
                  onSelect={() => task.categoryId !== null ? handleSelectCategory(task.categoryId) : null}
                  className="text-primary hover:bg-primary/10"
                >
                  Today
                </CommandItem>
                {categories.map((category) => (
                  <CommandItem
                    key={category.id}
                    onSelect={() => handleSelectCategory(category.id)}
                    disabled={category.id === task.categoryId && !task.inTodaySection}
                    className={category.id === task.categoryId && !task.inTodaySection ? "opacity-50" : ""}
                  >
                    {category.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
