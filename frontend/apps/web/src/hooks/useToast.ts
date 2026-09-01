import { toast } from '@/components/ui/toast-store';

/**
 * Hook that returns the global toast API.
 *
 * Usage:
 *   const { toast } = useToast();
 *   toast.success('Saved!');
 *   toast.error('Something went wrong');
 *   toast.info('Processing…');
 *   toast.warning('This cannot be undone');
 *
 * The toast object can also be imported directly from
 * '@/components/ui/toast-store' for use outside React components.
 */
export function useToast() {
  return { toast };
}
