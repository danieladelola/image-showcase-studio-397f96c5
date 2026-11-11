import {
  BatteryCharging,
  Cpu,
  Gauge,
  PlugZap,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Truck,
  Wallet,
  Wifi,
  Award,
  type LucideIcon,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  battery: BatteryCharging,
  inverter: Cpu,
  charging: PlugZap,
  panel: SunMedium,
  paygo: Wallet,
  warranty: Award,
  wifi: Wifi,
  gauge: Gauge,
  shield: ShieldCheck,
  delivery: Truck,
};

export function FeatureIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = icons[icon] ?? Sparkles;
  return <Icon className={className} aria-hidden="true" />;
}
