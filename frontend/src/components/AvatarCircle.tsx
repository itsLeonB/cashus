import { cn } from "@/lib/utils";

interface AvatarCircleProps {
  name: string;
  imageUrl?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getColorFromName(name: string): string {
  const colors = [
    "from-teal-400 to-cyan-500",
    "from-violet-400 to-purple-500",
    "from-rose-400 to-pink-500",
    "from-amber-400 to-orange-500",
    "from-emerald-400 to-green-500",
    "from-blue-400 to-indigo-500",
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.codePointAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

export function AvatarCircle({
  name,
  imageUrl,
  size = "md",
  className,
}: Readonly<AvatarCircleProps>) {
  const sizes = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
    xl: "h-16 w-16 text-lg",
  };

  if (imageUrl) {
    return (
      <img
        referrerPolicy="no-referrer"
        src={imageUrl}
        alt={name}
        className={cn(
          "rounded-full object-cover ring-2 ring-border",
          sizes[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold bg-gradient-to-br text-foreground",
        getColorFromName(name),
        sizes[size],
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
}
