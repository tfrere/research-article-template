// Simple store for triggering Trackio actions
import { writable } from 'svelte/store';

export const jitterTrigger = writable(0);

export function triggerJitter() {
  jitterTrigger.update(n => n + 1);
}
