import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ridesApi from '../api/rides.js';

export const rideKeys = {
  all: ['rides'],
  list: (query) => ['rides', 'list', query],
  detail: (id) => ['rides', 'detail', id],
};

export function useRides(query = {}, options = {}) {
  return useQuery({ queryKey: rideKeys.list(query), queryFn: () => ridesApi.listRides(query), ...options });
}

export function useRide(id) {
  return useQuery({ queryKey: rideKeys.detail(id), queryFn: () => ridesApi.getRide(id), enabled: !!id });
}

export function useCreateRide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ridesApi.createRide,
    onSuccess: (ride) => {
      queryClient.setQueryData(rideKeys.detail(ride.id), ride);
      queryClient.invalidateQueries({ queryKey: ['rides', 'list'] });
      // A saved plan means its foods can no longer be hard-deleted (they'd be archived)
      queryClient.invalidateQueries({ queryKey: ['foods'] });
    },
  });
}
