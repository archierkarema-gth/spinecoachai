import Link from "next/link";
import {
  Dumbbell,
  NotebookPen,
  HeartPulse,
  Camera,
  FileBarChart,
  Settings as SettingsIcon,
  ClipboardEdit,
} from "lucide-react";
import { TopBar } from "@/components/nav/top-bar";
import { Card } from "@/components/ui/card";

const ITEMS = [
  { href: "/assessment", label: "Asesmen awal", icon: ClipboardEdit },
  { href: "/library", label: "Exercise Library", icon: Dumbbell },
  { href: "/log", label: "Workout Log", icon: NotebookPen },
  { href: "/pain", label: "Pain Tracker", icon: HeartPulse },
  { href: "/photos", label: "Progress Photos", icon: Camera },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export default function MorePage() {
  return (
    <div>
      <TopBar title="More" subtitle="Semua halaman SpineCoach AI." />
      <div className="grid grid-cols-2 gap-3 px-5">
        {ITEMS.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="flex h-24 flex-col items-start justify-between hover:border-primary">
              <Icon size={20} className="text-primary" />
              <span className="text-sm font-medium text-card-foreground">
                {label}
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
