import { cn } from "./ui";

export function AppIcon({ src, name, size = 40, className }: { src?: string; name?: string; size?: number; className?: string }) {
  const letter = (name || "?").trim().charAt(0).toUpperCase();
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`${src}=s${size * 2}`} alt="" width={size} height={size} className={cn("shrink-0 rounded-[22%] bg-gray-100 object-cover", className)} style={{ width: size, height: size }} />;
  }
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-[22%] bg-gradient-to-br from-brand-500 to-brand-700 font-semibold text-white", className)}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {letter}
    </span>
  );
}
