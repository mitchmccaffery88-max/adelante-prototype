// §Adelante Journey sync Build C — resolves the `icon` NAME carried by a
// library category / recovery module into a real lucide component.
//
// The content modules stay pure data (a string), and admin-authored
// categories validate the name as PascalCase lucide. We deliberately do NOT
// import lucide's full `icons` map: that pulls every icon in the library into
// the patient bundle. Instead this is a curated set covering every name in
// the shipped catalog plus the ones an author is realistically going to pick,
// with an honest fallback rather than a blank space.
import {
  BookOpen,
  Brain,
  Briefcase,
  Compass,
  Flame,
  Handshake,
  Heart,
  HeartPulse,
  Home,
  Leaf,
  LifeBuoy,
  Map,
  Moon,
  Pill,
  Scale,
  Shield,
  Sparkles,
  Sprout,
  Sun,
  Sunrise,
  Target,
  Users,
  Waves,
  Wrench,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  BookOpen,
  Brain,
  Briefcase,
  Compass,
  Flame,
  Handshake,
  Heart,
  HeartPulse,
  Home,
  Leaf,
  LifeBuoy,
  Map,
  Moon,
  Pill,
  Scale,
  Shield,
  Sparkles,
  Sprout,
  Sun,
  Sunrise,
  Target,
  Users,
  Waves,
  Wrench,
};

/** Names an author can pick and have actually render. */
export const RESOLVABLE_ICON_NAMES = Object.keys(ICONS).sort();

export function resolveContentIcon(name: string | undefined): LucideIcon {
  return (name && ICONS[name]) || BookOpen;
}
