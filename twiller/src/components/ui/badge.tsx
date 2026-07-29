import * as React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outline" | "secondary" | "destructive";
}

export function Badge({ className = "", variant = "default", ...props }: BadgeProps) {
  const base = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
  const variants = {
    default: "border-transparent bg-blue-500/20 text-blue-400 border-blue-500/30",
    secondary: "border-transparent bg-gray-800 text-gray-200",
    destructive: "border-transparent bg-red-950/80 text-red-400 border-red-800/60",
    outline: "text-gray-300 border-gray-700",
  };

  return (
    <div className={`${base} ${variants[variant] || variants.default} ${className}`} {...props} />
  );
}
