'use client';

import {
  LayoutGrid, Package, Wrench, Home, Car, Gift, BedDouble, Laptop,
  Shirt, Leaf, Baby, Trophy, Hammer, BookOpen, PawPrint,
  Wallet, Search, Camera, Store, Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutGrid,
  Package,
  Wrench,
  Home,
  Car,
  Gift,
  BedDouble,
  Laptop,
  Shirt,
  Leaf,
  Baby,
  Trophy,
  Hammer,
  BookOpen,
  PawPrint,
  Wallet,
  Search,
  Camera,
  Store,
  Trash2,
};

export function CategoryIcon({ name, className = 'w-4 h-4' }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon className={className} />;
}

export { ICON_MAP };
