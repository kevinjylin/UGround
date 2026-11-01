import Image from "next/image";
import { cn } from "@/lib/cn";
import crowd from "@/public/concert-crowd.jpg";

interface StageSceneProps {
  /** Position, size and mask for the layer, like "inset-0 [mask-image:...]". */
  className?: string;
  /** Crop for the photo, as object-position classes like "object-[30%_60%]". */
  imageClassName?: string;
  priority?: boolean;
}

/**
 * The world UGround lives in: a crowd holding phones up to the stage.
 * The photo is toned to black and ember so it belongs to the page palette.
 * Callers fade its edges into the background with a mask.
 */
export function StageScene({ className, imageClassName, priority = false }: StageSceneProps) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute isolate overflow-hidden", className)}>
      <Image
        src={crowd}
        alt=""
        fill
        priority={priority}
        sizes="(min-width: 1024px) 70vw, 100vw"
        placeholder="blur"
        className={cn(
          "object-cover brightness-[0.8] contrast-[1.2] grayscale",
          imageClassName ?? "object-[50%_60%]",
        )}
      />
      {/* Ember duotone: highlights take the brand color, shadows stay black. */}
      <div className="absolute inset-0 bg-brand mix-blend-multiply" />
      <div className="absolute inset-0 bg-background/25" />
    </div>
  );
}
