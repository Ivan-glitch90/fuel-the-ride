import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as eventsApi from '../api/events.js';

export const eventKeys = {
  all: ['events'],
  list: (when) => ['events', 'list', when],
  detail: (id) => ['events', 'detail', id],
};

export function useEvents(when = 'upcoming', options = {}) {
  return useQuery({ queryKey: eventKeys.list(when), queryFn: () => eventsApi.listEvents(when), ...options });
}

export function useEvent(id) {
  return useQuery({ queryKey: eventKeys.detail(id), queryFn: () => eventsApi.getEvent(id), enabled: !!id });
}

function useEventMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (event) => {
      if (event?.id) queryClient.setQueryData(eventKeys.detail(event.id), event);
      queryClient.invalidateQueries({ queryKey: ['events', 'list'] });
    },
  });
}

export const useCreateEvent = () => useEventMutation(eventsApi.createEvent);
export const useUpdateEvent = () => useEventMutation(({ id, patch }) => eventsApi.updateEvent(id, patch));
export const useDeleteEvent = () => useEventMutation(eventsApi.deleteEvent);
