import { useCallback } from 'react';
import { confirmStore, type ConfirmOptions } from '@/components/ui/confirm-store';

/**
 * Hook that returns an async `confirm()` function.
 *
 * Usage:
 *   const { confirm } = useConfirm();
 *
 *   const yes = await confirm({
 *     title: 'Delete this listing?',
 *     description: 'This action cannot be undone.',
 *     confirmLabel: 'Delete',
 *     variant: 'destructive',
 *   });
 *   if (!yes) return;
 *
 * The `confirmStore.open` can also be imported directly from
 * '@/components/ui/confirm-store' for use outside React components.
 */
export function useConfirm() {
  const confirm = useCallback(
    (options: ConfirmOptions): Promise<boolean> => confirmStore.open(options),
    [],
  );

  return { confirm };
}
