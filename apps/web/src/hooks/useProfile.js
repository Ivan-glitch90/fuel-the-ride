import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateProfile } from '../api/users.js';
import { ME_KEY } from '../auth/AuthContext.jsx';

/** The profile is the logged-in user (cached under ['me']); saving updates that cache directly. */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (user) => queryClient.setQueryData(ME_KEY, user),
  });
}
