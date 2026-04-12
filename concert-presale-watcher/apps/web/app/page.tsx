"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef } from "react";

export default function LandingPage() {
  const proofRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = proofRef.current;
    if (!section) return;

    const cards = section.querySelectorAll("article");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="landingShell">
      <nav className="landingNav anim-slideDown" aria-label="Primary navigation">
        <Link href="/" className="landingWordmark" aria-label="UGround home">
          UGround
        </Link>
        <div className="landingNavLinks">
          <Link href="/login">Sign in</Link>
          <Link href="/signup" className="landingNavCta">
            Create account
          </Link>
        </div>
      </nav>

      <section className="landingHero">
        <div className="landingCopy">
          <p className="landingKicker anim-fadeUp" style={{ animationDelay: "0.15s" }}>
            Watchlist-powered concert alerts
          </p>
          <h1 className="anim-fadeUp" style={{ animationDelay: "0.3s" }}>
            Catch small-room tickets before the feed wakes up.
          </h1>
          <p className="landingLead anim-fadeUp" style={{ animationDelay: "0.45s" }}>
            Follow the artists, venues, and cities you care about. UGround checks public ticket sources and pings you when fresh dates or sale changes show up.
          </p>
          <div className="landingActions anim-fadeUp" style={{ animationDelay: "0.6s" }}>
            <Link href="/signup" className="landingButton landingButtonPrimary">
              Start watching
            </Link>
            <Link href="/login" className="landingButton landingButtonSecondary">
              I already have an account
            </Link>
          </div>
        </div>

        <div className="landingMedia anim-fadeScale" aria-label="Concert crowd">
          <Image
            src="https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=82"
            alt="A packed concert crowd under red stage lights"
            fill
            priority
            sizes="(max-width: 980px) 100vw, 46vw"
          />
        </div>
      </section>

      <section className="landingProof" ref={proofRef} aria-label="How UGround works">
        <article className="proofCard" style={{ transitionDelay: "0s" }}>
          <span>01</span>
          <h2>Follow your lane</h2>
          <p>Track the artists and scenes you actually care about instead of scanning every venue calendar by hand.</p>
        </article>
        <article className="proofCard" style={{ transitionDelay: "0.12s" }}>
          <span>02</span>
          <h2>Watch for changes</h2>
          <p>Ticketmaster, Eventbrite, and curated sources are checked for new listings, status flips, and earlier sale times.</p>
        </article>
        <article className="proofCard" style={{ transitionDelay: "0.24s" }}>
          <span>03</span>
          <h2>Move first</h2>
          <p>Email, Discord, and SMS hooks give you a fast heads-up when something worth acting on appears.</p>
        </article>
      </section>
    </main>
  );
}
