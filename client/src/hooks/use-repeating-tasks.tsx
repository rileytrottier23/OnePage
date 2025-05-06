import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { RepeatingTask } from "@shared/schema";

type CreateRepeatingTaskInput = {
  taskText: string;
  repeatType: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  targetCategoryId: number;
};

export function useRepeatingTasks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSettingUp, setIsSettingUp] = useState(false);

  // Get all repeating tasks
  const { 
    data: repeatingTasks = [], 
    isLoading: isLoadingRepeatingTasks,
    error: repeatingTasksError
  } = useQuery({
    queryKey: ['/api/repeating-tasks'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/repeating-tasks');
      if (!res.ok) {
        throw new Error('Failed to fetch repeating tasks');
      }
      return res.json();
    },
    // Only try to fetch if we explicitly set up a repeating task
    enabled: isSettingUp
  });

  // Create a new repeating task
  const createRepeatingTaskMutation = useMutation({
    mutationFn: async (data: CreateRepeatingTaskInput) => {
      const res = await apiRequest('POST', '/api/repeating-tasks', data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to create repeating task');
      }
      return res.json();
    },
    onSuccess: () => {
      setIsSettingUp(true);
      toast({
        title: 'Repeating task created',
        description: 'Your task has been scheduled for repetition.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/repeating-tasks'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create repeating task',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update a repeating task
  const updateRepeatingTaskMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<RepeatingTask> & { id: number }) => {
      const res = await apiRequest('PATCH', `/api/repeating-tasks/${id}`, data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to update repeating task');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Repeating task updated',
        description: 'Your repeating task has been updated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/repeating-tasks'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update repeating task',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete a repeating task
  const deleteRepeatingTaskMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/repeating-tasks/${id}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to delete repeating task');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Repeating task deleted',
        description: 'Your repeating task has been deleted successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/repeating-tasks'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete repeating task',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Process all repeating tasks
  const processRepeatingTasksMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/repeating-tasks/process');
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to process repeating tasks');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Repeating tasks processed',
        description: 'Your repeating tasks have been processed successfully.',
      });
      // Refresh tasks since we might have created new ones
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to process repeating tasks',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    repeatingTasks,
    isLoadingRepeatingTasks,
    repeatingTasksError,
    createRepeatingTask: createRepeatingTaskMutation.mutate,
    updateRepeatingTask: updateRepeatingTaskMutation.mutate,
    deleteRepeatingTask: deleteRepeatingTaskMutation.mutate,
    processRepeatingTasks: processRepeatingTasksMutation.mutate,
    isCreatingRepeatingTask: createRepeatingTaskMutation.isPending,
    isUpdatingRepeatingTask: updateRepeatingTaskMutation.isPending,
    isDeletingRepeatingTask: deleteRepeatingTaskMutation.isPending,
    isProcessingRepeatingTasks: processRepeatingTasksMutation.isPending,
  };
}