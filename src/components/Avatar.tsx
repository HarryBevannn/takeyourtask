import { UserRound } from "lucide-react";
import type { Profile } from "@/lib/types";
import { avatarGradient, displayName, initials } from "@/lib/utils";

export default function Avatar({
  profile,
  size = 26,
  online,
}: {
  profile?: Profile | null;
  size?: number;
  online?: boolean;
}) {
  const name = displayName(profile);

  // Nobody assigned: a faint dashed outline rather than something that reads as a help button.
  if (!profile) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-white/25 text-faint"
        style={{ width: size, height: size }}
        title={name}
      >
        <UserRound size={size * 0.55} strokeWidth={1.75} />
      </span>
    );
  }

  return (
    <span className="relative inline-flex shrink-0" title={name}>
      <span
        className="inline-flex items-center justify-center rounded-full font-semibold text-white ring-1 ring-white/30"
        style={{ width: size, height: size, fontSize: size * 0.4, background: avatarGradient(profile.id) }}
      >
        {initials(name)}
      </span>
      {online && (
        <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-[#11162e]" />
      )}
    </span>
  );
}
