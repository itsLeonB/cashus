import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function Logo({
  className,
  size = "md",
  showText = true,
}: Readonly<LogoProps>) {
  const sizes = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10",
  };

  const textSizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };

  const svgSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "gradient-primary rounded-lg flex items-center justify-center",
          sizes[size]
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={cn("text-primary-foreground", svgSizes[size])}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
          <path d="M12 18V6" />
        </svg>
      </div>
      {showText && (
        <span
          className={cn(
            "font-display font-bold text-foreground",
            textSizes[size]
          )}
        >
          Cashus
        </span>
      )}
    </div>
  );
}
