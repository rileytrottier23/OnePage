import { useState, KeyboardEvent, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Task, Category } from "@shared/schema";
import TaskItem from "./TaskItem";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pencil, Check } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";

interface CategorySectionProps {
  category: Category;
  tasks: Task[];
}

export default function CategorySection({ category, tasks }: CategorySectionProps) {
  const [newTaskText, setNewTaskText] = useState("");
  const [newSubtaskId, setNewSubtaskId] = useState<number | null>(null);
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [categoryName, setCategoryName] = useState(category.name);
  const newSubtaskRef = useRef<HTMLDivElement>(null);
  const newTaskInputRef = useRef<HTMLInputElement>(null);
  
  // Setup droppable area for drag and drop
  const { setNodeRef } = useDroppable({
    id: `category-${category.id}`,
    data: {
      type: 'category',
      categoryId: category.id
    }
  });

  // Filter active tasks and sort by parent-child relationships
  const activeTasks = tasks.filter(task => !task.inTodaySection);
  
  const [lastCreatedTaskId, setLastCreatedTaskId] = useState<number | null>(null);
  
  const addTaskMutation = useMutation({
    mutationFn: (text: string) => {
      return apiRequest("POST", "/api/tasks", {
        text,
        categoryId: category.id
      }).then(res => res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setNewTaskText("");
      // Store the last created task ID for potential indentation
      setLastCreatedTaskId(data.id);
      
      // Focus the input again to allow continuous task creation
      setTimeout(() => {
        if (newTaskInputRef.current) {
          newTaskInputRef.current.focus();
        }
      }, 0);
    }
  });

  const createSubtaskMutation = useMutation({
    mutationFn: ({ parentId, text }: { parentId: number, text: string }) => {
      return apiRequest("POST", `/api/tasks/${parentId}/subtask`, { text })
        .then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setNewSubtaskId(null);
    }
  });
  
  const updateCategoryMutation = useMutation({
    mutationFn: (name: string) => {
      return apiRequest("PATCH", `/api/categories/${category.id}`, { name })
        .then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setIsEditingCategory(false);
    }
  });



  // Define indent task mutation 
  const indentTaskMutation = useMutation({
    mutationFn: (taskId: number) => {
      return apiRequest("PATCH", `/api/tasks/${taskId}/indent`, { increase: true })
        .then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setLastCreatedTaskId(null);
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
  
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab") {
      // Prevent default Tab behavior
      e.preventDefault();
      
      if (lastCreatedTaskId !== null) {
        // Indent the last created task
        indentTaskMutation.mutate(lastCreatedTaskId);
      } else if (newTaskText.trim() !== "") {
        // If there's text in the input and we press Tab, create a task and remember to indent it
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
    // Get root tasks (no parent)
    const rootTasks = activeTasks.filter(task => !task.parentTaskId);
    
    // Sort root tasks: incomplete tasks first (by id), then completed tasks (by id)
    const sortedRootTasks = [
      ...rootTasks.filter(task => !task.completed).sort((a, b) => a.id - b.id),
      ...rootTasks.filter(task => task.completed).sort((a, b) => a.id - b.id)
    ];
    
    const taskMap = new Map<number, Task[]>();
    
    // Create a map of parent to children
    activeTasks.forEach(task => {
      if (task.parentTaskId) {
        const children = taskMap.get(task.parentTaskId) || [];
        children.push(task);
        taskMap.set(task.parentTaskId, children);
      }
    });
    
    // Sort children in each parent's group: incomplete tasks first, then completed tasks
    taskMap.forEach((children, parentId) => {
      // Replace the children array with a sorted version
      taskMap.set(parentId, [
        ...children.filter(task => !task.completed).sort((a, b) => a.id - b.id),
        ...children.filter(task => task.completed).sort((a, b) => a.id - b.id)
      ]);
    });

    // Helper function to render a task and its children
    const renderTaskHierarchy = (task: Task): JSX.Element[] => {
      const result: JSX.Element[] = [
        <TaskItem 
          key={task.id} 
          task={task} 
          categoryName={category.name}
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
    return sortedRootTasks.flatMap(renderTaskHierarchy);
  };

  const handleSaveCategoryName = () => {
    if (categoryName.trim() !== '' && categoryName !== category.name) {
      updateCategoryMutation.mutate(categoryName.trim());
    } else {
      setIsEditingCategory(false);
      setCategoryName(category.name);
    }
  };

  const handleCategoryNameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveCategoryName();
    } else if (e.key === 'Escape') {
      setIsEditingCategory(false);
      setCategoryName(category.name);
    }
  };

  return (
    <section 
      ref={setNodeRef} 
      className="mb-6 category-container p-4 transition-colors duration-200 hover:bg-card/80"
    >
      <div className="flex justify-between items-center mb-3">
        {isEditingCategory ? (
          <div className="flex items-center">
            <Input
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              onKeyDown={handleCategoryNameKeyDown}
              className="text-xl font-semibold bg-background/70 focus:bg-background"
              autoFocus
            />
            <button 
              onClick={handleSaveCategoryName}
              className="ml-2 p-1 rounded-full hover:bg-muted"
              disabled={updateCategoryMutation.isPending}
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <h2 className="text-xl font-semibold flex items-center group">
            <span>{category.name}</span>
            <span className="ml-2 text-muted-foreground">
              {activeTasks.length}
            </span>
            <button 
              onClick={() => setIsEditingCategory(true)}
              className="ml-2 p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </h2>
        )}
      </div>

      <div className="tasks-container">
        {organizeTasks()}
        
        <div className="mt-3">
          <Input
            ref={newTaskInputRef}
            type="text"
            placeholder={`Add a ${category.name.toLowerCase()} task...`}
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
                
                // Re-focus the input
                setTimeout(() => {
                  if (newTaskInputRef.current) {
                    newTaskInputRef.current.focus();
                  }
                }, 0);
              } else {
                setNewTaskText(e.target.value);
              }
            }}
            onKeyUp={handleAddTask}
            onKeyDown={handleKeyDown}
            disabled={addTaskMutation.isPending || indentTaskMutation.isPending}
          />
        </div>
      </div>
    </section>
  );
}
