import { create } from 'zustand';
import type { Anchor, AnchorStatus } from '../types';
import { anchorsApi } from '../api';

interface AnchorState {
  anchors: Anchor[];
  total: number;
  loading: boolean;
  error: string | null;
  search: string;
  status: AnchorStatus | undefined;

  setSearch: (search: string) => void;
  setStatus: (status: AnchorStatus | undefined) => void;
  fetchAnchors: () => Promise<void>;
  createAnchor: (data: any) => Promise<Anchor>;
  updateAnchor: (id: string, data: any) => Promise<Anchor>;
  deleteAnchor: (id: string) => Promise<void>;
}

export const useAnchorStore = create<AnchorState>((set, get) => ({
  anchors: [],
  total: 0,
  loading: false,
  error: null,
  search: '',
  status: undefined,

  setSearch: (search) => {
    set({ search });
    get().fetchAnchors();
  },

  setStatus: (status) => {
    set({ status });
    get().fetchAnchors();
  },

  fetchAnchors: async () => {
    set({ loading: true, error: null });
    try {
      const { search, status } = get();
      const response = await anchorsApi.list({ search, status });
      set({ anchors: response.items, total: response.total });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  createAnchor: async (data) => {
    const anchor = await anchorsApi.create(data);
    await get().fetchAnchors();
    return anchor;
  },

  updateAnchor: async (id, data) => {
    const anchor = await anchorsApi.update(id, data);
    await get().fetchAnchors();
    return anchor;
  },

  deleteAnchor: async (id) => {
    await anchorsApi.delete(id);
    await get().fetchAnchors();
  },
}));