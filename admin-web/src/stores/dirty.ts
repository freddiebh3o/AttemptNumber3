// admin-web/src/stores/dirty.ts
import { create } from 'zustand';

type SaveHandler = () => Promise<void> | void;

type DirtyState = {
  isDirty: boolean;
  reason?: string | null;
  saving: boolean;
  saveHandler: SaveHandler | null;

  setDirty: (dirty: boolean, reason?: string | null) => void;
  registerSaveHandler: (fn: SaveHandler | null) => void;
  _setSaving: (saving: boolean) => void; // internal
};

export const useDirtyStore = create<DirtyState>((set) => ({
  isDirty: false,
  reason: null,
  saving: false,
  saveHandler: null,

  setDirty(dirty, reason) {
    set((s) => ({
      isDirty: dirty,
      reason: dirty ? (reason ?? s.reason ?? 'You have unsaved changes') : null,
    }));
  },

  registerSaveHandler(fn) {
    set({ saveHandler: fn });
  },

  _setSaving(saving) {
    set({ saving });
  },
}));
