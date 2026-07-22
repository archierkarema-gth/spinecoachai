import Link from "next/link";
import {
  Dumbbell,
  NotebookPen,
  HeartPulse,
  Camera,
  FileBarChart,
  Settings as SettingsIcon,
  ClipboardEdit,
  Wind,
  Timer,
  Activity,
  ScanLine,
  ListChecks,
} from "lucide-react";
import { TopBar } from "@/components/nav/top-bar";
import { Card, CardTitle } from "@/components/ui/card";

// M16 scoliosis tools & timers (spec §8, §9).
const TOOLS = [
  { href: "/breathing", label: "Breathing Counter", icon: Wind },
  { href: "/kegel", label: "Kegel Timer", icon: Timer },
  { href: "/ribhump", label: "Rib Hump Tracker", icon: Activity },
  { href: "/asymmetry", label: "Asymmetry Logger", icon: ListChecks },
  { href: "/mirror", label: "Mirror Check", icon: ScanLine },
  { href: "/poses", label: "Schroth Poses", icon: Wind },
] as const;

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
      <div className="flex flex-col gap-5 px-5">
        <section>
          <CardTitle>Alat skoliosis</CardTitle>
          <div className="grid grid-cols-2 gap-3">
            {TOOLS.map(({ href, label, icon: Icon }) => (
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
        </section>

        <section>
          <CardTitle>Lainnya</CardTitle>
          <div className="grid grid-cols-2 gap-3">
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
        </section>
      </div>
    </div>
  );
}
