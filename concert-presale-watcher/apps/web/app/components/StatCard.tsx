import type { CSSProperties } from "react";
import styles from "../dashboard/dashboard.module.css";

interface StatCardProps {
  label: string;
  value: number;
  loading?: boolean;
  accent?: string;
}

export default function StatCard({
  label,
  value,
  loading,
  accent,
}: StatCardProps) {
  return (
    <article
      className={`${styles.panel} ${styles.statPanel}`}
      style={
        accent ? ({ "--stat-accent": accent } as CSSProperties) : undefined
      }
    >
      <i className={styles.statAccent} aria-hidden="true" />
      <span>{label}</span>
      {loading ? (
        <div
          className={`${styles.skeleton} ${styles.skeletonNumber}`}
          aria-hidden="true"
        />
      ) : (
        <strong>{value}</strong>
      )}
    </article>
  );
}
