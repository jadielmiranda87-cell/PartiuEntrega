import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useAlert } from '@/template';

function newLineId(): string {
  return `L${Date.now().toString(36)}${Math.random().toString(36).slice(2, 11)}`;
}

export interface CartLine {
  lineId: string;
  productId: string;
  businessId: string;
  businessName: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
}

interface CartContextType {
  lines: CartLine[];
  businessId: string | null;
  businessName: string | null;
  subtotal: number;
  itemCount: number;
  addLine: (line: Omit<CartLine, 'lineId' | 'quantity'> & { lineId?: string; quantity?: number }) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  removeLine: (lineId: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const { showAlert } = useAlert();

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);

  const clearCart = useCallback(() => {
    setLines([]);
    setBusinessId(null);
    setBusinessName(null);
  }, []);

  const addLine = useCallback(
    (line: Omit<CartLine, 'lineId' | 'quantity'> & { lineId?: string; quantity?: number }) => {
      const qty = Math.max(1, line.quantity ?? 1);
      const notesNorm = (line.notes ?? '').trim();
      setLines((prev) => {
        if (prev.length > 0 && prev[0].businessId !== line.businessId) {
          showAlert(
            'Outro restaurante',
            'Seu carrinho tem itens de outro estabelecimento. Esvazie o carrinho para adicionar daqui.',
            [{ text: 'OK' }]
          );
          return prev;
        }
        const i = prev.findIndex(
          (p) => p.productId === line.productId && (p.notes ?? '').trim() === notesNorm
        );
        if (i >= 0) {
          const next = [...prev];
          next[i] = { ...next[i], quantity: next[i].quantity + qty };
          return next;
        }
        const row: CartLine = {
          lineId: line.lineId ?? newLineId(),
          productId: line.productId,
          businessId: line.businessId,
          businessName: line.businessName,
          productName: line.productName,
          unitPrice: line.unitPrice,
          quantity: qty,
          notes: notesNorm || undefined,
        };
        return [...prev, row];
      });
      setBusinessId(line.businessId);
      setBusinessName(line.businessName);
    },
    [showAlert]
  );

  const setQuantity = useCallback((lineId: string, quantity: number) => {
    if (quantity < 1) {
      setLines((prev) => prev.filter((p) => p.lineId !== lineId));
      return;
    }
    setLines((prev) => prev.map((p) => (p.lineId === lineId ? { ...p, quantity } : p)));
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setLines((prev) => prev.filter((p) => p.lineId !== lineId));
  }, []);

  useEffect(() => {
    if (lines.length === 0) {
      setBusinessId(null);
      setBusinessName(null);
    } else {
      setBusinessId(lines[0].businessId);
      setBusinessName(lines[0].businessName);
    }
  }, [lines]);

  const value: CartContextType = {
    lines,
    businessId,
    businessName,
    subtotal,
    itemCount,
    addLine,
    setQuantity,
    removeLine,
    clearCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
