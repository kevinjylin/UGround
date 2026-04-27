interface ErrorBannerProps {
  message: string;
  className?: string;
}

export default function ErrorBanner({ message, className }: ErrorBannerProps) {
  return (
    <p
      className={className ?? "errorBanner"}
      role="alert"
      aria-live="assertive"
    >
      {message}
    </p>
  );
}
