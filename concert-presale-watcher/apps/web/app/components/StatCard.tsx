interface StatCardProps {
  label: string;
  value: number;
  loading?: boolean;
  accent?: string;
}

export default function StatCard({ label, value, loading, accent }: StatCardProps) {
  return (
    <article
      className="panel statPanel"
      style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}
    >
      <span>{label}</span>
      {loading ? (
        <div className="skeleton skeleton--number" aria-hidden="true" />
      ) : (
        <strong>{value}</strong>
      )}
    </article>
  );
}
