import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  subcategory?: string;
  order?: number;
  imageUrl: string;
  available: boolean;
  isVeg?: boolean;
  catalogMissing?: boolean;
}

export interface CartItem extends MenuItem {
  quantity: number;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: MenuItem) => void;
  syncMenuCatalog: (catalog: MenuItem[]) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        set((state) => {
          const existingItem = state.items.find((i) => i.id === item.id);
          if (existingItem) {
            return {
              items: state.items.map((i) =>
                i.id === item.id
                  ? { ...i, ...item, catalogMissing: false, quantity: i.quantity + 1 }
                  : i
              ),
            };
          }
          return { items: [...state.items, { ...item, catalogMissing: false, quantity: 1 }] };
        });
      },
      syncMenuCatalog: (catalog) => {
        const currentItems = new Map(catalog.map((item) => [item.id, item]));
        set((state) => ({
          items: state.items.map((cartItem) => {
            const currentItem = currentItems.get(cartItem.id);
            if (!currentItem) {
              return { ...cartItem, available: false, catalogMissing: true };
            }
            return {
              ...cartItem,
              ...currentItem,
              quantity: cartItem.quantity,
              catalogMissing: false,
            };
          }),
        }));
      },
      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        }));
      },
      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, quantity } : i
          ),
        }));
      },
      clearCart: () => set({ items: [] }),
      getTotal: () => {
        return get().items.reduce((total, item) => total + (item.price || 0) * item.quantity, 0);
      },
    }),
    {
      name: 'elpestro-cart', // localStorage key
    }
  )
);
