import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/cn";

interface ErrorBannerProps {
  message: string;
  className?: string;
}

export default function ErrorBanner({ message, className }: ErrorBannerProps) {
  return (
    <Alert
      variant="destructive"
      aria-live="assertive"
      className={cn("border-destructive/30 bg-destructive/5", className)}
    >
      <CircleAlert />
      <AlertDescription className="text-destructive">{message}</AlertDescription>
    </Alert>
  );
}
