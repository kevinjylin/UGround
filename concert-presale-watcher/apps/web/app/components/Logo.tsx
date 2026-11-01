import { cn } from "@/lib/cn";
import Image from "next/image";
import icon from "../icon.png";

interface LogoProps {
  size?: number;
  className?: string;
  /** Show the "UGround" wordmark next to the mark. */
  wordmark?: boolean;
}

/** UGround's ember U, with staggered heights inspired by audio levels. */
export function LogoMark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <Image
      src={icon}
      alt=""
      width={size}
      height={size}
      aria-hidden="true"
      className={cn("shrink-0 rounded-[20%]", className)}
    />
  );
}

export default function Logo({ size = 20, className, wordmark = true }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-foreground", className)}>
      <LogoMark size={size} />
      {wordmark ? <span className="text-[17px] leading-none font-semibold">UGround</span> : null}
    </span>
  );
}
