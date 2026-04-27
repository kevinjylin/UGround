"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import styles from "../auth.module.css";

interface AuthFrameProps {
  kicker: string;
  title: string;
  lead: string;
  children: ReactNode;
}

export default function AuthFrame({
  kicker,
  title,
  lead,
  children,
}: AuthFrameProps) {
  return (
    <main id="auth-flow" className={styles.authPage}>
      <div className={styles.authShell}>
        <section className={styles.editorialPanel} aria-label="UGround">
          <Link href="/" className={styles.brand}>
            UGround
          </Link>
          <div className={styles.editorialCopy}>
            <p className={styles.eyebrow}>Presale intelligence</p>
            <h2>Catch the show before the feed wakes up.</h2>
            <p>
              A private watchlist for ticket drops, status flips, and the
              moments that disappear fastest.
            </p>
          </div>
          <div className={styles.editorialLedger} aria-hidden="true">
            <span>01 / Watch</span>
            <span>02 / Detect</span>
            <span>03 / Alert</span>
          </div>
        </section>

        <section className={styles.formPanel}>
          <div className={styles.panelHeader}>
            <p className={styles.eyebrow}>{kicker}</p>
            <h1>{title}</h1>
            <p>{lead}</p>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
