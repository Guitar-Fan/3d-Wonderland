import { create } from 'zustand';

export const useStore = create((set, get) => ({
  models: [],
  selectedIds: [],
  transformMode: 'translate', // translate, rotate, scale
  appMode: 'select', // select, sketch_select_plane, sketch_line, sketch_rect
  sketchPlane: null, // { position: Vector3, normal: Vector3, quaternion: Quaternion }
  sketches: [],

  setAppMode: (mode) => set({ appMode: mode }),
  setSketchPlane: (plane) => set({ sketchPlane: plane, appMode: 'sketch_line' }),
  addSketchElement: (element) => set(state => ({ sketches: [...state.sketches, element] })),
  clearSketch: () => set({ sketchPlane: null, sketches: [], appMode: 'select' }),

  addModel: (model) => set((state) => ({ models: [...state.models, model] })),
  removeModel: (id) => set((state) => ({ 
    models: state.models.filter(m => m.id !== id),
    selectedIds: state.selectedIds.filter(selectedId => selectedId !== id)
  })),
  updateModel: (id, data) => set((state) => ({
    models: state.models.map(m => m.id === id ? { ...m, ...data } : m)
  })),
  clearModels: () => set({ models: [], selectedIds: [] }),
  
  toggleSelection: (id, multi = false) => set((state) => {
      const isSelected = state.selectedIds.includes(id);
      if (multi) {
          return { selectedIds: isSelected ? state.selectedIds.filter(i => i !== id) : [...state.selectedIds, id] };
      } else {
          return { selectedIds: isSelected && state.selectedIds.length === 1 ? [] : [id] };
      }
  }),
  clearSelection: () => set({ selectedIds: [] }),
  
  setTransformMode: (mode) => set({ transformMode: mode })
}));
