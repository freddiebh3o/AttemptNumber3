type Listener = (active: boolean) => void;

class LoadingBus {
  private count = 0;
  private listeners = new Set<Listener>();
  start() { this.count++; this.emit(); }
  done() { this.count = Math.max(0, this.count - 1); this.emit(); }
  on(fn: Listener) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit(){ const active = this.count > 0; this.listeners.forEach(l => l(active)); }
}
export const loadingBus = new LoadingBus();
