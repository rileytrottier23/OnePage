import { useState, KeyboardEvent, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Task, Category } from "@shared/schema";
import { ChevronUp, ChevronDown, GripVertical, Repeat, Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDraggable } from "@dnd-kit/core";
import { useRepeatingTasks } from "@/hooks/use-repeating-tasks";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandSeparator } from "@/components/ui/command";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

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
  const [isRepeatDialogOpen, setIsRepeatDialogOpen] = useState(false);
  const [repeatType, setRepeatType] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly'>('daily');
  const [repeatCategoryId, setRepeatCategoryId] = useState<number | null>(task.categoryId);

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
  
  const handleOpenRepeatDialog = () => {
    setIsRepeatDialogOpen(true);
    setOpen(false);
  };
  
  // Use our repeating tasks hook
  const { createRepeatingTask, isCreatingRepeatingTask } = useRepeatingTasks();
  
  const handleSetupRepeatingTask = () => {
    if (!repeatCategoryId) {
      // This should not happen as we have validation, but just in case
      return;
    }
    
    // Create the repeating task using our hook
    createRepeatingTask({
      taskText: task.text,
      repeatType,
      targetCategoryId: repeatCategoryId
    });
    
    // Close the dialog
    setIsRepeatDialogOpen(false);
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
    <>
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
          className="drag-handle opacity-0 group-hover:opacity-70 mr-0.5 cursor-grab flex items-center p-0.5 hover:bg-muted rounded"
          title="Drag to move"
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </button>
        
        <Checkbox 
          className="h-3.5 w-3.5 rounded border-gray-600 mr-1.5" 
          checked={isChecked} 
          onCheckedChange={handleCheckboxChange}
          disabled={updateTaskMutation.isPending || moveTaskMutation.isPending}
        />
        <span className={cn("flex-grow flex items-center leading-tight", task.completed && "completed-task")}>
          {task.indentLevel > 0 && (
            <span className="subtask-indicator"></span>
          )}
          {task.text}
        </span>
        
        {inTodaySection && task.originalCategory && (
          <span className={cn("text-xs text-muted-foreground mr-1.5", task.completed && "opacity-50")}>
            {task.originalCategory}
          </span>
        )}
        
        {inTodaySection ? (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button 
                className="text-muted-foreground hover:text-primary p-0.5"
                onClick={handleMoveTask}
                disabled={updateTaskMutation.isPending || moveTaskMutation.isPending}
                aria-label="Move task to category"
              >
                <ChevronDown className="h-3 w-3" />
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
                <CommandSeparator />
                <CommandGroup heading="Repeating">
                  <CommandItem
                    onSelect={handleOpenRepeatDialog}
                    className="text-primary"
                  >
                    <Repeat className="mr-2 h-4 w-4" />
                    Set up repeating task
                  </CommandItem>
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        ) : (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button 
                className="text-muted-foreground hover:text-primary p-0.5"
                onClick={handleMoveTask}
                disabled={updateTaskMutation.isPending || moveTaskMutation.isPending}
                aria-label="Move task to category"
              >
                <ChevronUp className="h-3 w-3" />
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
                <CommandSeparator />
                <CommandGroup heading="Repeating">
                  <CommandItem
                    onSelect={handleOpenRepeatDialog}
                    className="text-primary"
                  >
                    <Repeat className="mr-2 h-4 w-4" />
                    Set up repeating task
                  </CommandItem>
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Dialog for setting up repeating task */}
      <Dialog open={isRepeatDialogOpen} onOpenChange={setIsRepeatDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Set Up Repeating Task</DialogTitle>
            <DialogDescription>
              Select how often this task should repeat and in which category it should appear.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Task</h4>
              <div className="bg-secondary/30 p-2 rounded-md text-sm">
                {task.text}
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Repeat Schedule</h4>
              <RadioGroup value={repeatType} onValueChange={(value) => setRepeatType(value as any)} className="grid grid-cols-2 gap-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="daily" id="daily" />
                  <Label htmlFor="daily" className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    Daily
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="weekly" id="weekly" />
                  <Label htmlFor="weekly" className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    Weekly
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="monthly" id="monthly" />
                  <Label htmlFor="monthly" className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    Monthly
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="quarterly" id="quarterly" />
                  <Label htmlFor="quarterly" className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    Quarterly
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Target Category</h4>
              <Select value={repeatCategoryId?.toString() || ''} onValueChange={(value) => setRepeatCategoryId(Number(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <h4 className="font-medium text-sm">Creation Time</h4>
              </div>
              <div className="text-sm text-muted-foreground">
                Task will be recreated at 7:00 AM on the scheduled day.
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRepeatDialogOpen(false)} disabled={isCreatingRepeatingTask}>
              Cancel
            </Button>
            <Button onClick={handleSetupRepeatingTask} disabled={isCreatingRepeatingTask || !repeatCategoryId}>
              {isCreatingRepeatingTask ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
