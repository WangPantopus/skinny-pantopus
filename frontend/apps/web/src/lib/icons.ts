// ============================================================
// Icon mapping — centralised Lucide React icon registry.
// Import from here instead of using emoji characters.
// ============================================================

import {
  LayoutDashboard,
  Newspaper,
  Search,
  Store,
  Map,
  Plus,
  Bookmark,
  Briefcase,
  MessageCircle,
  Mail,
  CreditCard,
  Settings,
  Home,
  Building2,
  ClipboardList,
  Tag,
  Wrench,
  User,
  BarChart3,
  AlertTriangle,
  Package,
  FileText,
  CircleAlert,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  MapPin,
  Star,
  TrendingUp,
  Users,
  Hammer,
  Wallet,
  CheckSquare,
  Megaphone,
  Palette,
  Clock,
  CalendarClock,
  Plane,
  MailOpen,
  Archive,
  Wifi,
  DoorOpen,
  Lock,
  Construction,
  Siren,
  Key,
  SquareParking,
  Menu,
  Bell,
  LogOut,
  Compass,
  Sun,
  ShoppingBag,
  ListTodo,
  HandCoins,
  ShieldCheck,
  Radio,
  type LucideIcon,
} from 'lucide-react';

// ── Navigation icons (sidebar, header, tabs) ─────────────────
export const NavIcons = {
  place: Home,
  hub: LayoutDashboard,
  // Four-tab IA (wedge Phase 1.5): Place · Today · Nearby · Mail.
  today: Sun,
  nearby: Compass,
  mail: Mail,
  /** @deprecated the door is "Nearby" now; kept for any stale reference. */
  neighborhood: Users,
  feed: Newspaper,
  discover: Compass,
  marketplace: ShoppingBag,
  tasks: Briefcase,
  messages: MessageCircle,
  // Calendarly scheduling hub (personal/home/business via the in-hub pillar switcher).
  scheduling: CalendarClock,
  // Audience destination — unified-IA §3.2: distinct visual cue from
  // every Personal-zone item. Radio matches the megaphone metaphor used
  // in the audience-zone notification stream (P2.3).
  audience: Radio,
  beacon: Radio,
  map: Map,
  connections: Users,
  identity: ShieldCheck,
  myTasks: ListTodo,
  myBids: HandCoins,
  // Legacy aliases (still used in some pages)
  browseTasks: Map,
  postTask: Plus,
  savedTasks: Bookmark,
  offers: Briefcase,
  chat: MessageCircle,
  personalMailbox: Mail,
  payments: CreditCard,
  settings: Settings,
  myHomes: Home,
  myBusinesses: Building2,
  myGigs: ClipboardList,
  myListings: Tag,
  myPulse: Newspaper,
  savedListings: Bookmark,
  professional: Wrench,
  profile: User,
  back: ChevronLeft,
  collapseLeft: ChevronsLeft,
  collapseRight: ChevronsRight,
  menu: Menu,
  notifications: Bell,
  search: Search,
  logout: LogOut,
} satisfies Record<string, LucideIcon>;

// ── Home dashboard icons ─────────────────────────────────────
export const HomeIcons = {
  overview: BarChart3,
  propertyDetails: Building2,
  tasks: ClipboardList,
  issues: Wrench,
  bills: Wallet,
  members: Users,
  scheduling: CalendarClock,
  mailbox: Mail,
  packages: Package,
  documents: FileText,
  vendors: Wrench,
  emergency: CircleAlert,
  settings: Settings,
  back: ChevronLeft,
} satisfies Record<string, LucideIcon>;

// ── Business dashboard icons ─────────────────────────────────
export const BusinessIcons = {
  overview: BarChart3,
  profile: Store,
  locations: MapPin,
  catalog: Package,
  pages: FileText,
  postTask: Plus,
  chat: MessageCircle,
  team: Users,
  reviews: Star,
  insights: TrendingUp,
  payments: CreditCard,
  settings: Settings,
  back: ChevronLeft,
} satisfies Record<string, LucideIcon>;

// ── Quick-create FAB icons ───────────────────────────────────
export const QuickCreateIcons = {
  task: ClipboardList,
  issue: Wrench,
  bill: Wallet,
  package: Package,
  member: Users,
  gig: Hammer,
} satisfies Record<string, LucideIcon>;

// ── Quick Access (home) icons ────────────────────────────────
export const AccessIcons = {
  wifi: Wifi,
  door_code: DoorOpen,
  gate_code: Lock,
  lockbox: Package,
  garage: Construction,
  alarm: Siren,
  other: Key,
  key: Key,
  parking: SquareParking,
  entry: DoorOpen,
  emergency: CircleAlert,
  home: Home,
  familyView: Home,
  guestView: User,
} satisfies Record<string, LucideIcon>;

// ── Mailbox nav icons ────────────────────────────────────────
export const MailboxIcons = {
  brand: Mail,
  personal: User,
  home: Home,
  business: Briefcase,
  earn: Wallet,
  counter: AlertTriangle,
  vault: Archive,
  map: MapPin,
  community: Megaphone,
  tasks: CheckSquare,
  records: Home,
  earnWallet: Wallet,
  mailDay: MailOpen,
  stamps: Palette,
  memory: Clock,
  travel: Plane,
} satisfies Record<string, LucideIcon>;

// ── ProfileToggle icons ──────────────────────────────────────
export const IdentityIcons = {
  personal: User,
  professional: Wrench,
  home: Home,
  business: Building2,
  add: Plus,
} satisfies Record<string, LucideIcon>;

// ── Hub page inline icons ────────────────────────────────────
export const HubIcons = {
  addHome: Plus,
  chat: MessageCircle,
  mail: Mail,
  bills: CreditCard,
  taskDue: CheckSquare,
  packages: Package,
  wallet: Wallet,
  people: Users,
  postTask: Plus,
  invite: Users,
  payout: CreditCard,
} satisfies Record<string, LucideIcon>;

// ── Brand icon ───────────────────────────────────────────────
// The Pantopus octopus stays as text, not an emoji in nav chrome.
// Use this for the brand mark in headers / badges.
export { LayoutDashboard as BrandIcon };
