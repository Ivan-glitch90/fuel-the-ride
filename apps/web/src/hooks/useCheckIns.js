import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as checkInsApi from '../api/checkins.js';
import { rideKeys } from './useRides.js';

export const checkInKeys = { forRide: (rideId) => ['checkins', rideId] };

export function useCheckIn(rideId) {
  return useQuery({ queryKey: checkInKeys.forRide(rideId), queryFn: () => checkInsApi.getCheckInForRide(rideId) });
}

/** Saves (creates or updates) the ride's check-in. Creating also marks the ride completed. */
export function useSaveCheckIn(rideId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, answers }) =>
      id ? checkInsApi.updateCheckIn(id, answers) : checkInsApi.createCheckIn({ rideId, ...answers }),
    onSuccess: (checkIn) => {
      queryClient.setQueryData(checkInKeys.forRide(rideId), checkIn);
      queryClient.invalidateQueries({ queryKey: rideKeys.detail(rideId) });
      queryClient.invalidateQueries({ queryKey: ['rides', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['events'] }); // trained-rate history feeds event build-ups
    },
  });
}
