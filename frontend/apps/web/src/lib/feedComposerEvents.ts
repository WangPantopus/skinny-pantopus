export const FEED_COMPOSER_OPEN_EVENT = 'pantopus:feed-composer-open';
export const FEED_POST_CREATED_EVENT = 'pantopus:feed-post-created';
export const MAGIC_TASK_OPEN_EVENT = 'pantopus:magic-task-open';

export function openFeedComposer(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FEED_COMPOSER_OPEN_EVENT));
}

export function openMagicTaskComposer(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(MAGIC_TASK_OPEN_EVENT));
}

export function notifyFeedPostCreated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FEED_POST_CREATED_EVENT));
}
