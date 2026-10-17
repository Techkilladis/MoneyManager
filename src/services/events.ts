// Minimal app-wide "data changed" signal. Screens subscribe (via
// useScreenData) and reload when a write happens anywhere — a manual
// entry, a confirmed capture, or a background UPI sync.
type Listener = () => void;

const listeners = new Set<Listener>();

export const dataEvents = {
  emit(): void {
    listeners.forEach((l) => {
      try {
        l();
      } catch (error) {
        console.warn('[dataEvents] listener failed:', error);
      }
    });
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
