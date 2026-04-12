interface ErrorBannerProps {
  message: string;
}

export default function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <p className="errorBanner" role="alert" aria-live="assertive">
      {message}
    </p>
  );
}
