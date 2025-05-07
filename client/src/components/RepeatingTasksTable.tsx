import { useRepeatingTasks } from "@/hooks/use-repeating-tasks";
import { useQuery } from "@tanstack/react-query";
import { Category, RepeatingTask } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Trash, Edit, Calendar, MoreHorizontal } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useState } from "react";

export default function RepeatingTasksTable() {
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const {
    repeatingTasks,
    isLoadingRepeatingTasks,
    updateRepeatingTask,
    deleteRepeatingTask,
  } = useRepeatingTasks();
  
  const [selectedTask, setSelectedTask] = useState<RepeatingTask | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [repeatType, setRepeatType] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly'>('daily');
  const [targetCategoryId, setTargetCategoryId] = useState<number | null>(null);
  
  const handleOpenEditDialog = (task: RepeatingTask) => {
    setSelectedTask(task);
    setRepeatType(task.repeatType as any);
    setTargetCategoryId(task.categoryId);
    setIsEditDialogOpen(true);
  };
  
  const handleOpenDeleteDialog = (task: RepeatingTask) => {
    setSelectedTask(task);
    setIsDeleteDialogOpen(true);
  };
  
  const handleSaveEdit = () => {
    if (!selectedTask || !targetCategoryId) return;
    
    updateRepeatingTask.mutate({
      id: selectedTask.id,
      repeatType,
      categoryId: targetCategoryId
    });
    
    setIsEditDialogOpen(false);
  };
  
  const handleDelete = () => {
    if (!selectedTask) return;
    
    deleteRepeatingTask.mutate(selectedTask.id);
    setIsDeleteDialogOpen(false);
  };
  
  const getRepeatTypeLabel = (type: string) => {
    switch (type) {
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'monthly': return 'Monthly';
      case 'quarterly': return 'Quarterly';
      default: return type;
    }
  };
  
  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId) return 'None';
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Unknown';
  };
  
  if (isLoadingRepeatingTasks) {
    return <div className="text-center p-4">Loading repeating tasks...</div>;
  }
  
  if (!repeatingTasks || repeatingTasks.length === 0) {
    return (
      <div className="text-center p-4 text-muted-foreground">
        No repeating tasks set up yet. Create one by selecting "Set up repeating task" on any task.
      </div>
    );
  }
  
  return (
    <div className="repeating-tasks-container">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Task</TableHead>
            <TableHead>Frequency</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {repeatingTasks.map((task) => (
            <TableRow key={task.id}>
              <TableCell className="font-medium">{task.taskText}</TableCell>
              <TableCell>{getRepeatTypeLabel(task.repeatType)}</TableCell>
              <TableCell>{getCategoryName(task.categoryId)}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleOpenEditDialog(task)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleOpenDeleteDialog(task)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Repeating Task</DialogTitle>
            <DialogDescription>
              Change how often this task repeats and which category it appears in.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Task</h4>
              <div className="bg-secondary/30 p-2 rounded-md text-sm">
                {selectedTask?.taskText}
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Repeat Schedule</h4>
              <RadioGroup value={repeatType} onValueChange={(value) => setRepeatType(value as any)} className="grid grid-cols-2 gap-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="daily" id="edit-daily" />
                  <Label htmlFor="edit-daily" className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    Daily
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="weekly" id="edit-weekly" />
                  <Label htmlFor="edit-weekly" className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    Weekly
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="monthly" id="edit-monthly" />
                  <Label htmlFor="edit-monthly" className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    Monthly
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="quarterly" id="edit-quarterly" />
                  <Label htmlFor="edit-quarterly" className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    Quarterly
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Target Category</h4>
              <Select 
                value={targetCategoryId?.toString() || ''} 
                onValueChange={(value) => setTargetCategoryId(Number(value))}
              >
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
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsEditDialogOpen(false)} 
              disabled={updateRepeatingTask.isPending}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEdit} 
              disabled={updateRepeatingTask.isPending || !targetCategoryId}
            >
              {updateRepeatingTask.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Repeating Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this repeating task? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="bg-secondary/30 p-2 rounded-md text-sm">
              {selectedTask?.taskText} - {getRepeatTypeLabel(selectedTask?.repeatType || '')}
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)} 
              disabled={deleteRepeatingTask.isPending}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDelete} 
              disabled={deleteRepeatingTask.isPending}
            >
              {deleteRepeatingTask.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}