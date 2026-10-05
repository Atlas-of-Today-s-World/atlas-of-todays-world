import {
  BookOpen,
  CalendarDays,
  ChartColumn,
  Clapperboard,
  Database,
  FileText,
  Flag,
  Globe,
  GraduationCap,
  HeartHandshake,
  Image as ImageIcon,
  Landmark,
  Leaf,
  Lightbulb,
  Link as LinkIcon,
  type LucideIcon,
  Map as MapIcon,
  Mic,
  Newspaper,
  PenLine,
  Podcast,
  Quote,
  Scale,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toTileIcon, type TileIcon as TileIconName } from "../constants";

const ICONS: Record<TileIconName, LucideIcon> = {
  video: Clapperboard,
  podcast: Podcast,
  mic: Mic,
  chart: ChartColumn,
  database: Database,
  map: MapIcon,
  book: BookOpen,
  news: Newspaper,
  file: FileText,
  pen: PenLine,
  quote: Quote,
  graduation: GraduationCap,
  idea: Lightbulb,
  people: Users,
  landmark: Landmark,
  scale: Scale,
  shield: ShieldCheck,
  flag: Flag,
  heart: HeartHandshake,
  leaf: Leaf,
  calendar: CalendarDays,
  image: ImageIcon,
  globe: Globe,
  link: LinkIcon,
};

/** The picture of a tile icon (public tiles and the admin picker share it). */
export function TileIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[toTileIcon(name)];
  return <Icon aria-hidden className={className} />;
}
