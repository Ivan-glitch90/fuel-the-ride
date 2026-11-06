import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as foodsApi from '../api/foods.js';

export const foodKeys = {
  all: ['foods'],
  list: (query) => ['foods', 'list', query],
  detail: (id) => ['foods', 'detail', id],
};

export function useFoods(query = { archived: 'false' }, options = {}) {
  return useQuery({ queryKey: foodKeys.list(query), queryFn: () => foodsApi.listFoods(query), ...options });
}

export function useFood(id, options = {}) {
  return useQuery({ queryKey: foodKeys.detail(id), queryFn: () => foodsApi.getFood(id), enabled: !!id, ...options });
}

export function useCreateFood() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: foodsApi.createFood,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: foodKeys.all }),
  });
}

export function useUpdateFood() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }) => foodsApi.updateFood(id, patch),
    onSuccess: (food) => {
      queryClient.setQueryData(foodKeys.detail(food.id), food);
      queryClient.invalidateQueries({ queryKey: ['foods', 'list'] });
    },
  });
}

export function useDeleteFood() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: foodsApi.deleteFood,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: foodKeys.all }),
  });
}
