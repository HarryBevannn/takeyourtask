import type { Profile } from "@/lib/types";
import { colourFor, displayName, initials } from "@/lib/utils";

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
  return (
    <span className="relative inline-flex shrink-0" title={name}>
      <span
        className="inline-flex items-center justify-center rounded-full font-semibold text-white ring-1 ring-white/30"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.4,
          background: profile
            ? `linear-gradient(135deg, ${colourFor(profile.id)}, ${colourFor(profile.id + "x")})`
            : "rgba(255,255,255,0.12)",
        }}
      >
        {profile ? initials(name) : "?"}
      </span>
      {online && (
        <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-[#11162e]" />
      )}
    </span>
  );
}
