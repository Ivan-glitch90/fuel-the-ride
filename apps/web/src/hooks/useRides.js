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

export function useUpdateRide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }) => ridesApi.updateRide(id, patch),
    onSuccess: (ride) => {
      queryClient.setQueryData(rideKeys.detail(ride.id), ride);
      queryClient.invalidateQueries({ queryKey: ['rides', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['foods'] }); // logged foods can no longer be hard-deleted
    },
  });
}

export function useDeleteRide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ridesApi.deleteRide,
    onSuccess: (_, id) => {
      // Forget (don't refetch) the ride and its check-in: both are gone
      queryClient.removeQueries({ queryKey: rideKeys.detail(id) });
      queryClient.removeQueries({ queryKey: ['checkins', id] });
      queryClient.invalidateQueries({ queryKey: ['rides', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] }); // its check-in and intake leave the charts
      queryClient.invalidateQueries({ queryKey: ['foods'] }); // its foods may be hard-deletable again
    },
  });
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
