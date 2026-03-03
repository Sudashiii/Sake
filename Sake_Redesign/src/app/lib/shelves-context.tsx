import React, { createContext, useContext, useState, useCallback } from 'react';
import { defaultShelves, createEmptyRuleGroup, type Shelf, type RuleGroup } from './mock-data';

interface ShelvesContextType {
  shelves: Shelf[];
  createShelf: (name: string, icon: string) => void;
  renameShelf: (id: string, name: string, icon: string) => void;
  deleteShelf: (id: string) => void;
  updateShelfRuleGroup: (id: string, ruleGroup: RuleGroup) => void;
}

const ShelvesContext = createContext<ShelvesContextType | null>(null);

export function ShelvesProvider({ children }: { children: React.ReactNode }) {
  const [shelves, setShelves] = useState<Shelf[]>(defaultShelves);

  const createShelf = useCallback((name: string, icon: string) => {
    setShelves((prev) => [
      ...prev,
      {
        id: `shelf-${Date.now()}`,
        name,
        icon,
        createdAt: new Date().toISOString().split('T')[0],
        ruleGroup: createEmptyRuleGroup(),
      },
    ]);
  }, []);

  const renameShelf = useCallback((id: string, name: string, icon: string) => {
    setShelves((prev) => prev.map((s) => (s.id === id ? { ...s, name, icon } : s)));
  }, []);

  const deleteShelf = useCallback((id: string) => {
    setShelves((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const updateShelfRuleGroup = useCallback((id: string, ruleGroup: RuleGroup) => {
    setShelves((prev) => prev.map((s) => (s.id === id ? { ...s, ruleGroup } : s)));
  }, []);

  return (
    <ShelvesContext.Provider value={{ shelves, createShelf, renameShelf, deleteShelf, updateShelfRuleGroup }}>
      {children}
    </ShelvesContext.Provider>
  );
}

export function useShelves() {
  const ctx = useContext(ShelvesContext);
  if (!ctx) throw new Error('useShelves must be used within ShelvesProvider');
  return ctx;
}
