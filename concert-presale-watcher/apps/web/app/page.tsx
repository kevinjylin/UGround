"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import styles from "./landing.module.css";

// ── Video / asset URLs ──────────────────────────────────────────────────────
const HERO_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260307_083826_e938b29f-a43a-41ec-a153-3d4730578ab8.mp4";
const PROCESS_HLS =
  "https://stream.mux.com/9JXDljEVWYwWu01PUkAemafDugK89o01BR6zqJ3aS9u00A.m3u8";
const STATS_HLS =
  "https://stream.mux.com/NcU3HlHeF7CUL86azTTzpy3Tlb00d6iF3BmCdFslMJYM.m3u8";
const CTA_HLS =
  "https://stream.mux.com/8wrHPCX2dC3msyYU9ObwqNdm00u3ViXvOSHUMRYSEe5Q.m3u8";
const FEATURE_GIF_1 =
  "https://motionsites.ai/assets/hero-finlytic-preview-CV9g0FHP.gif";
const FEATURE_GIF_2 =
  "https://motionsites.ai/assets/hero-wealth-preview-B70idl_u.gif";

const PARTNERS = ["Stripe", "Vercel", "Linear", "Notion", "Figma"];

// ── Icons ───────────────────────────────────────────────────────────────────
function ArrowUpRight({ size = 14, stroke = 1.5 }: { size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}
function PlayIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  );
}
function ZapIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
function PaletteIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r="0.8" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r="0.8" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r="0.8" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r="0.8" fill="currentColor" />
      <path d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 10 10c0 2.5-2.5 3-3 3h-3a2 2 0 0 0-2 2c0 1 1 1.5 1 2.5 0 1.5-1.5 2.5-3 2.5z" />
    </svg>
  );
}
function BarChartIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="12" y1="20" x2="12" y2="8" />
      <line x1="18" y1="20" x2="18" y2="11" />
      <line x1="3" y1="20" x2="21" y2="20" />
    </svg>
  );
}
function ShieldIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

// ── Animation components ────────────────────────────────────────────────────
interface BlurTextProps {
  text: string;
  delay?: number;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
  style?: React.CSSProperties;
  splitBy?: "word" | "char";
}

function BlurText({
  text,
  delay = 80,
  className = "",
  as: As = "h1",
  style = {},
  splitBy = "word",
}: BlurTextProps) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [el]);

  const parts = splitBy === "word" ? text.split(/(\s+)/) : text.split("");
  const Tag = As as React.ElementType;

  return (
    <Tag
      ref={(node: HTMLElement | null) => setEl(node)}
      className={className}
      style={style}
      aria-label={text}
    >
      {parts.map((p, i) => {
        if (/^\s+$/.test(p)) return <span key={i}>{p}</span>;
        const d = (i * delay) / 1000;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              filter: visible ? "blur(0px)" : "blur(10px)",
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(40px)",
              transition: `filter 700ms cubic-bezier(0.2,0.7,0.2,1) ${d}s, opacity 700ms cubic-bezier(0.2,0.7,0.2,1) ${d}s, transform 700ms cubic-bezier(0.2,0.7,0.2,1) ${d}s`,
              willChange: "filter, opacity, transform",
            }}
          >
            {p}
          </span>
        );
      })}
    </Tag>
  );
}

interface BlurInProps {
  delay?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

function BlurIn({ delay = 0, children, style = {}, className = "" }: BlurInProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        }),
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        filter: visible ? "blur(0px)" : "blur(10px)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: `filter 600ms ease ${delay}s, opacity 600ms ease ${delay}s, transform 600ms ease ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

// ── HLS video ───────────────────────────────────────────────────────────────
function useHls(src: string) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || !src) return;
    let hlsInstance: Hls | undefined;
    if (v.canPlayType("application/vnd.apple.mpegurl")) {
      v.src = src;
    } else if (Hls.isSupported()) {
      hlsInstance = new Hls({ enableWorker: false });
      hlsInstance.loadSource(src);
      hlsInstance.attachMedia(v);
    } else {
      v.src = src;
    }
    return () => {
      if (hlsInstance) hlsInstance.destroy();
    };
  }, [src]);
  return ref;
}

function HlsVideo({
  src,
  className,
  saturate = 1,
}: {
  src: string;
  className?: string;
  saturate?: number;
}) {
  const ref = useHls(src);
  return (
    <video
      ref={ref}
      className={className ?? styles.videoBg}
      autoPlay
      loop
      muted
      playsInline
      style={{ filter: saturate === 1 ? "none" : `saturate(${saturate})` }}
    />
  );
}

// ── Masthead ────────────────────────────────────────────────────────────────
function Masthead() {
  return (
    <header
      style={{ position: "fixed", top: 16, left: 0, right: 0, zIndex: 50, padding: "0 32px" }}
    >
      <div className={styles.shell} style={{ padding: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              className={styles.liquidGlass}
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span className={styles.fontHeading} style={{ fontSize: 22, lineHeight: 1, color: "#fff" }}>
                S
              </span>
            </div>
          </div>

          <nav
            className={styles.liquidGlass}
            style={{
              borderRadius: 999,
              padding: "6px 8px",
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            {["Home", "Services", "Work", "Process", "Pricing"].map((l) => (
              <a
                key={l}
                href={`#${l.toLowerCase()}`}
                style={{
                  padding: "8px 14px",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.9)",
                  textDecoration: "none",
                  fontWeight: 400,
                }}
              >
                {l}
              </a>
            ))}
            <a
              href="#start"
              className={styles.btnWhite}
              style={{ marginLeft: 6, padding: "6px 14px", fontSize: 12 }}
            >
              Get Started <ArrowUpRight size={12} />
            </a>
          </nav>

          <div style={{ width: 44 }} />
        </div>
      </div>
    </header>
  );
}

// ── Hero ────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={{ position: "relative", overflow: "hidden", paddingTop: 120, paddingBottom: 64 }}>
      <video
        className={styles.videoBg}
        autoPlay
        loop
        muted
        playsInline
        style={{ filter: "saturate(0.85) brightness(0.55)", opacity: 0.55 }}
        src={HERO_VIDEO}
      />
      <div
        className={styles.dimOverlay}
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.85) 100%)",
        }}
      />
      <div className={styles.fadeBottomTall} />

      <div className={`${styles.shell} ${styles.z10}`}>
        {/* Masthead strip */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            paddingBottom: 18,
            borderBottom: "2px solid rgba(255,255,255,0.85)",
            marginBottom: 56,
            marginTop: 24,
          }}
        >
          <div>
            <div className={styles.eyebrow}>VOL. 04 · ISSUE 12 · APRIL 2026</div>
            <div
              className={styles.fontHeading}
              style={{ fontSize: "clamp(40px, 5vw, 64px)", lineHeight: 0.9, marginTop: 4 }}
            >
              The Studio Index
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className={styles.eyebrow}>$0.00 · WEB EDITION</div>
            <div className={styles.fontHeading} style={{ fontSize: 22, lineHeight: 1, marginTop: 6 }}>
              &ldquo;Design, wildly reimagined.&rdquo;
            </div>
          </div>
        </div>

        {/* Hero spread */}
        <div className={styles.heroGrid}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <BlurIn>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <div
                    className={`${styles.liquidGlass} ${styles.pill}`}
                    style={{ paddingLeft: 6, paddingRight: 14, borderRadius: 999 }}
                  >
                    <span
                      style={{
                        background: "#fff",
                        color: "#0a0a0b",
                        padding: "3px 10px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      New
                    </span>
                    <span style={{ fontSize: 12 }}>Introducing AI-powered web design.</span>
                  </div>
                </div>
              </BlurIn>
              <BlurText
                text="The Website Your Brand Deserves"
                delay={90}
                as="h1"
                className={styles.hMega}
                style={{ marginTop: 28, maxWidth: 800 }}
              />
              <BlurIn delay={0.6}>
                <p
                  className={styles.lead}
                  style={{ maxWidth: 520, marginTop: 28, color: "rgba(255,255,255,0.85)" }}
                >
                  Stunning design. Blazing performance. Built by AI, refined by experts. This is web
                  design, wildly reimagined.
                </p>
              </BlurIn>
            </div>
            <BlurIn delay={1.0}>
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "center",
                  marginTop: 32,
                  flexWrap: "wrap",
                }}
              >
                <a
                  href="#start"
                  className={`${styles.liquidGlassStrong} ${styles.pillStrong}`}
                  style={{ borderRadius: 999, padding: "12px 22px", fontSize: 14 }}
                >
                  Get Started <ArrowUpRight size={14} />
                </a>
                <button className={styles.btnText}>
                  <span
                    className={styles.liquidGlass}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <PlayIcon size={10} />
                  </span>
                  Watch the Film
                </button>
              </div>
            </BlurIn>
          </div>

          {/* Right: video portrait card */}
          <BlurIn delay={0.3}>
            <div
              className={styles.liquidGlass}
              style={{
                borderRadius: 24,
                overflow: "hidden",
                height: "100%",
                minHeight: 460,
                position: "relative",
              }}
            >
              <video
                autoPlay
                loop
                muted
                playsInline
                src={HERO_VIDEO}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.6) 100%)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 16,
                  bottom: 14,
                  right: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-end",
                }}
              >
                <div>
                  <div className={styles.eyebrow} style={{ fontSize: 9 }}>
                    COVER · 04.12
                  </div>
                  <div className={styles.fontHeading} style={{ fontSize: 22, lineHeight: 1 }}>
                    Studio at work
                  </div>
                </div>
                <div
                  className={`${styles.liquidGlass} ${styles.pill}`}
                  style={{ borderRadius: 999, padding: "4px 10px", fontSize: 10 }}
                >
                  ● LIVE
                </div>
              </div>
            </div>
          </BlurIn>
        </div>

        {/* From the editor strip */}
        <div className={styles.heroByline}>
          <div>
            <div className={styles.eyebrow} style={{ marginBottom: 6 }}>
              FROM THE EDITOR
            </div>
            <div className={styles.fontHeading} style={{ fontSize: 22, lineHeight: 1.05 }}>
              An issue about <span className={styles.hl}>making things, fast.</span>
            </div>
          </div>
          <div className={styles.body}>
            Five years ago a website took a quarter to ship. Today it takes a week. We built the
            studio that makes that possible — and built it for the brands who refuse to wait.
          </div>
          <div>
            <div className={styles.eyebrow} style={{ marginBottom: 6 }}>
              IN THIS ISSUE
            </div>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              {[
                ["I", "The Process", "02"],
                ["II", "Capabilities", "04"],
                ["III", "By the Numbers", "07"],
                ["IV", "Letters", "09"],
                ["V", "Begin", "11"],
              ].map(([num, title, page]) => (
                <li
                  key={num}
                  className={styles.body}
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>
                    <span className={styles.fontHeading} style={{ fontSize: 16 }}>
                      {num}
                    </span>{" "}
                    · {title}
                  </span>
                  <span className={styles.tiny}>p. {page}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Trust marquee */}
        <div
          style={{
            marginTop: 56,
            paddingTop: 24,
            borderTop: "1px dashed rgba(255,255,255,0.18)",
            overflow: "hidden",
          }}
        >
          <div className={styles.eyebrow} style={{ marginBottom: 16 }}>
            TRUSTED BY THE TEAMS BEHIND
          </div>
          <div
            style={{
              overflow: "hidden",
              maskImage:
                "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)",
            }}
          >
            <div className={styles.marquee}>
              {[...PARTNERS, ...PARTNERS, ...PARTNERS].map((p, i) => (
                <span
                  key={i}
                  className={styles.fontHeading}
                  style={{
                    fontSize: "clamp(28px, 3.4vw, 44px)",
                    color: "rgba(255,255,255,0.9)",
                    lineHeight: 1,
                  }}
                >
                  {p}
                  <span style={{ marginLeft: 72, color: "rgba(255,255,255,0.25)" }}>◆</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Process ─────────────────────────────────────────────────────────────────
function ProcessSection() {
  return (
    <section id="start" style={{ position: "relative", overflow: "hidden", padding: "140px 0" }}>
      <HlsVideo src={PROCESS_HLS} />
      <div className={styles.dimOverlay} style={{ background: "rgba(0,0,0,0.55)" }} />
      <div className={styles.fadeTop} />
      <div className={styles.fadeBottom} />

      <div className={`${styles.shell} ${styles.z10}`}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 32,
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div className={`${styles.liquidGlass} ${styles.pill}`} style={{ borderRadius: 999 }}>
            Chapter I · How it works
          </div>
          <div className={styles.eyebrow} style={{ opacity: 0.6 }}>
            PP. 02–03
          </div>
        </div>

        <BlurText
          text="You dream it. We ship it."
          className={styles.hSection}
          as="h2"
          style={{ maxWidth: 900, marginBottom: 24 }}
          delay={70}
        />
        <BlurIn delay={0.3}>
          <p className={styles.lead} style={{ maxWidth: 620, marginBottom: 36 }}>
            Share your vision. Our AI handles the rest — wireframes, design, code, launch. All in
            days, not quarters.
          </p>
        </BlurIn>

        <div className={styles.processGrid}>
          {[
            ["01", "Brief", "Share your vision in a 30-minute call."],
            ["02", "Wireframe", "AI sketches the bones within hours."],
            ["03", "Build", "Designed. Coded. Refined by experts."],
            ["04", "Launch", "Live in days, not quarters."],
          ].map(([n, t, d], i, arr) => (
            <div
              key={n}
              style={{
                padding: "32px 24px 32px 0",
                borderRight:
                  i < arr.length - 1 ? "1px dashed rgba(255,255,255,0.18)" : "none",
                paddingLeft: i === 0 ? 0 : 24,
              }}
            >
              <div className={styles.numplate} style={{ marginBottom: 12 }}>
                {n}
              </div>
              <div className={styles.fontHeading} style={{ fontSize: 28, lineHeight: 1, marginBottom: 8 }}>
                {t}
              </div>
              <div className={styles.body} style={{ color: "rgba(255,255,255,0.7)" }}>
                {d}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 40 }}>
          <a
            href="#cta"
            className={`${styles.liquidGlassStrong} ${styles.pillStrong}`}
            style={{ borderRadius: 999, padding: "14px 24px", fontSize: 14 }}
          >
            Get Started <ArrowUpRight size={14} />
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Features chess ──────────────────────────────────────────────────────────
function FeaturesChess() {
  return (
    <section id="services" style={{ background: "#000", padding: "120px 0" }}>
      <div className={styles.shell}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 40,
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              className={`${styles.liquidGlass} ${styles.pill}`}
              style={{ borderRadius: 999, marginBottom: 18, display: "inline-flex" }}
            >
              Chapter II · Capabilities
            </div>
            <BlurText
              text="Pro features. Zero complexity."
              className={styles.hSection}
              as="h2"
              style={{ maxWidth: 900 }}
              delay={70}
            />
          </div>
          <div className={styles.eyebrow} style={{ opacity: 0.6 }}>
            PP. 04–06
          </div>
        </div>

        {/* Row 1 */}
        <div
          className={styles.chess}
          style={{
            gridTemplateColumns: "1fr 1.3fr",
            gap: 56,
            alignItems: "center",
            paddingTop: 56,
            paddingBottom: 56,
            borderTop: "1px dashed rgba(255,255,255,0.18)",
          }}
        >
          <BlurIn>
            <div className={styles.eyebrow} style={{ marginBottom: 14 }}>
              Essay 01 · Design
            </div>
            <h3
              className={styles.fontHeading}
              style={{
                fontSize: "clamp(32px, 3.6vw, 52px)",
                lineHeight: 1,
                marginBottom: 20,
                letterSpacing: "-0.015em",
              }}
            >
              Designed to convert.
              <br />
              <span className={styles.hl}>Built to perform.</span>
            </h3>
            <p className={styles.body} style={{ marginBottom: 24, maxWidth: 480 }}>
              Every pixel is intentional. Our AI studies what works across thousands of top sites —
              then builds yours to outperform them all.
            </p>
            <a
              href="#"
              className={`${styles.liquidGlassStrong} ${styles.pillStrong}`}
              style={{ borderRadius: 999, padding: "12px 22px", fontSize: 13 }}
            >
              Learn more <ArrowUpRight size={13} />
            </a>
          </BlurIn>
          <BlurIn delay={0.2}>
            <div
              className={styles.liquidGlass}
              style={{
                borderRadius: 24,
                overflow: "hidden",
                aspectRatio: "16 / 11",
                background: "#0a0a0b",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={FEATURE_GIF_1}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
          </BlurIn>
        </div>

        {/* Row 2 */}
        <div
          className={styles.chess}
          style={{
            gridTemplateColumns: "1.3fr 1fr",
            gap: 56,
            alignItems: "center",
            paddingTop: 56,
            paddingBottom: 56,
            borderTop: "1px dashed rgba(255,255,255,0.18)",
          }}
        >
          <BlurIn>
            <div
              className={styles.liquidGlass}
              style={{
                borderRadius: 24,
                overflow: "hidden",
                aspectRatio: "16 / 11",
                background: "#0a0a0b",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={FEATURE_GIF_2}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
          </BlurIn>
          <BlurIn delay={0.2}>
            <div className={styles.eyebrow} style={{ marginBottom: 14 }}>
              Essay 02 · Intelligence
            </div>
            <h3
              className={styles.fontHeading}
              style={{
                fontSize: "clamp(32px, 3.6vw, 52px)",
                lineHeight: 1,
                marginBottom: 20,
                letterSpacing: "-0.015em",
              }}
            >
              It gets smarter.
              <br />
              <span className={styles.hl}>Automatically.</span>
            </h3>
            <p className={styles.body} style={{ marginBottom: 24, maxWidth: 480 }}>
              Your site evolves on its own. AI monitors every click, scroll, and conversion — then
              optimizes in real time. No manual updates. Ever.
            </p>
            <a
              href="#"
              className={`${styles.liquidGlassStrong} ${styles.pillStrong}`}
              style={{ borderRadius: 999, padding: "12px 22px", fontSize: 13 }}
            >
              See how it works <ArrowUpRight size={13} />
            </a>
          </BlurIn>
        </div>
      </div>
    </section>
  );
}

// ── Pull quote ───────────────────────────────────────────────────────────────
function PullQuote() {
  return (
    <section style={{ padding: "120px 0", background: "#000" }}>
      <div className={styles.shell}>
        <div
          style={{
            borderTop: "2px solid rgba(255,255,255,0.85)",
            borderBottom: "2px solid rgba(255,255,255,0.85)",
            padding: "64px 24px",
            textAlign: "center",
            maxWidth: 1100,
            margin: "0 auto",
          }}
        >
          <BlurText
            text='"A complete rebuild in five days. The result outperformed everything we had spent months building before."'
            className={styles.fontHeading}
            style={{ fontSize: "clamp(32px, 4.5vw, 64px)", lineHeight: 1.05, letterSpacing: "-0.01em" }}
            delay={40}
          />
          <div className={styles.eyebrow} style={{ marginTop: 28 }}>
            — SARAH CHEN, CEO · LUMINARY
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Why Us ───────────────────────────────────────────────────────────────────
type IconComp = ({ size }: { size?: number }) => React.ReactElement;

function WhyUs() {
  const items: [string, IconComp, string, string][] = [
    ["A", ZapIcon, "Days, Not Months", "Concept to launch at a pace that redefines fast. Because waiting isn't a strategy."],
    ["B", PaletteIcon, "Obsessively Crafted", "Every detail considered. Every element refined. Design so precise, it feels inevitable."],
    ["C", BarChartIcon, "Built to Convert", "Layouts informed by data. Decisions backed by performance. Results you can measure."],
    ["D", ShieldIcon, "Secure by Default", "Enterprise-grade protection comes standard. SSL, DDoS mitigation, compliance. All included."],
  ];

  return (
    <section id="work" style={{ background: "#000", padding: "120px 0" }}>
      <div className={styles.shell}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 40,
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              className={`${styles.liquidGlass} ${styles.pill}`}
              style={{ borderRadius: 999, marginBottom: 18, display: "inline-flex" }}
            >
              Why Us
            </div>
            <BlurText
              text="The difference is everything."
              className={styles.hSection}
              as="h2"
              style={{ maxWidth: 900 }}
              delay={70}
            />
          </div>
          <div className={styles.eyebrow} style={{ opacity: 0.6 }}>
            PP. 07
          </div>
        </div>

        <div className={styles.grid4} style={{ marginTop: 24 }}>
          {items.map(([k, Icon, t, d]) => (
            <BlurIn key={k} delay={0.05 * "ABCD".indexOf(k)}>
              <div
                className={`${styles.liquidGlass} ${styles.cardLift}`}
                style={{
                  borderRadius: 20,
                  padding: 26,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 28,
                  }}
                >
                  <div
                    className={styles.liquidGlassStrong}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={18} />
                  </div>
                  <div
                    className={styles.fontHeading}
                    style={{ fontSize: 28, lineHeight: 1, color: "rgba(255,255,255,0.4)" }}
                  >
                    {k}
                  </div>
                </div>
                <h4
                  className={styles.fontHeading}
                  style={{ fontSize: 28, lineHeight: 1, marginBottom: 12, letterSpacing: "-0.01em" }}
                >
                  {t}
                </h4>
                <p
                  className={styles.body}
                  style={{ color: "rgba(255,255,255,0.65)", marginTop: "auto" }}
                >
                  {d}
                </p>
              </div>
            </BlurIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Stats ────────────────────────────────────────────────────────────────────
function Stats() {
  return (
    <section style={{ position: "relative", overflow: "hidden", padding: "160px 0" }}>
      <HlsVideo src={STATS_HLS} saturate={0} />
      <div className={styles.dimOverlay} style={{ background: "rgba(0,0,0,0.6)" }} />
      <div className={styles.fadeTop} />
      <div className={styles.fadeBottom} />

      <div className={`${styles.shell} ${styles.z10}`}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 40,
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              className={`${styles.liquidGlass} ${styles.pill}`}
              style={{ borderRadius: 999, marginBottom: 18, display: "inline-flex" }}
            >
              Chapter III · By the numbers
            </div>
            <BlurText
              text="The receipts."
              className={styles.hSection}
              as="h2"
              style={{ maxWidth: 900 }}
              delay={70}
            />
          </div>
          <div className={styles.eyebrow} style={{ opacity: 0.6 }}>
            P. 08
          </div>
        </div>

        <BlurIn>
          <div className={styles.liquidGlass} style={{ borderRadius: 28, padding: "8px 36px" }}>
            {[
              ["200+", "Sites launched", "since 2024"],
              ["98%", "Client satisfaction", "verified"],
              ["3.2×", "More conversions", "median lift"],
              ["5 days", "Average delivery", "concept to live"],
            ].map(([v, l, ctx]) => (
              <div key={l} className={styles.ledgerRow}>
                <div
                  className={styles.fontHeading}
                  style={{
                    fontSize: "clamp(56px, 7vw, 96px)",
                    lineHeight: 0.85,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {v}
                </div>
                <div>
                  <div
                    style={{ fontSize: 18, color: "#fff", fontWeight: 500, fontFamily: "Barlow, sans-serif" }}
                  >
                    {l}
                  </div>
                  <div className={styles.body} style={{ marginTop: 4 }}>
                    —
                  </div>
                </div>
                <div className={`${styles.ledgerCtx} ${styles.eyebrow}`}>{ctx}</div>
              </div>
            ))}
          </div>
        </BlurIn>
      </div>
    </section>
  );
}

// ── Testimonials ─────────────────────────────────────────────────────────────
function Testimonials() {
  const quotes: [string, string, string][] = [
    ["A complete rebuild in five days. The result outperformed everything we had spent months building before.", "Sarah Chen", "CEO, Luminary"],
    ["Conversions up 4×. That's not a typo. The design just works differently when it's built on real data.", "Marcus Webb", "Head of Growth, Arcline"],
    ["They didn't just design our site. They defined our brand. World-class doesn't begin to cover it.", "Elena Voss", "Brand Director, Helix"],
  ];

  return (
    <section style={{ background: "#000", padding: "120px 0" }}>
      <div className={styles.shell}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 40,
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              className={`${styles.liquidGlass} ${styles.pill}`}
              style={{ borderRadius: 999, marginBottom: 18, display: "inline-flex" }}
            >
              Chapter IV · Letters
            </div>
            <BlurText
              text="In their words."
              className={styles.hSection}
              as="h2"
              style={{ maxWidth: 900 }}
              delay={70}
            />
          </div>
          <div className={styles.eyebrow} style={{ opacity: 0.6 }}>
            PP. 09–10
          </div>
        </div>

        <div className={styles.grid3} style={{ marginTop: 24 }}>
          {quotes.map(([q, n, r], i) => (
            <BlurIn key={n} delay={0.1 * i}>
              <div
                className={`${styles.liquidGlass} ${styles.cardLift}`}
                style={{
                  borderRadius: 20,
                  padding: 32,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  className={styles.fontHeading}
                  style={{
                    fontSize: 64,
                    lineHeight: 0.6,
                    color: "rgba(255,255,255,0.55)",
                    marginBottom: 12,
                  }}
                >
                  &ldquo;
                </div>
                <p
                  style={{
                    fontSize: 18,
                    lineHeight: 1.4,
                    color: "rgba(255,255,255,0.85)",
                    fontWeight: 300,
                    fontStyle: "italic",
                    margin: 0,
                    fontFamily: "Barlow, sans-serif",
                    marginBottom: "auto",
                  }}
                >
                  {q}
                </p>
                <hr className={styles.ruleDashed} style={{ margin: "28px 0 16px" }} />
                <div
                  style={{ fontSize: 14, color: "#fff", fontWeight: 500, fontFamily: "Barlow, sans-serif" }}
                >
                  {n}
                </div>
                <div className={styles.tiny} style={{ marginTop: 2 }}>
                  {r}
                </div>
              </div>
            </BlurIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── CTA + Footer ─────────────────────────────────────────────────────────────
function CtaFooter() {
  const footerCols = [
    { heading: "Studio", links: ["Services", "Work", "Process", "Pricing"] },
    { heading: "Resources", links: ["Field Guide", "Case Studies", "Changelog", "Blog"] },
    { heading: "Contact", links: ["hello@studio.com", "Twitter ↗", "LinkedIn ↗", "Instagram ↗"] },
  ];

  return (
    <section id="cta" style={{ position: "relative", overflow: "hidden", padding: "180px 0 0" }}>
      <HlsVideo src={CTA_HLS} />
      <div className={styles.dimOverlay} style={{ background: "rgba(0,0,0,0.45)" }} />
      <div className={styles.fadeTop} />

      <div className={`${styles.shell} ${styles.z10}`}>
        <div className={styles.eyebrow} style={{ marginBottom: 14 }}>
          Chapter V · Begin
        </div>
        <BlurText
          text="Your next website starts here."
          className={styles.fontHeading}
          style={{
            fontSize: "clamp(56px, 8vw, 128px)",
            lineHeight: 0.85,
            letterSpacing: "-0.02em",
            maxWidth: 1100,
            marginBottom: 28,
          }}
          delay={70}
        />
        <BlurIn delay={0.4}>
          <p
            className={styles.lead}
            style={{ maxWidth: 560, marginBottom: 36, color: "rgba(255,255,255,0.85)" }}
          >
            Book a free strategy call. See what AI-powered design can do. No commitment, no
            pressure. Just possibilities.
          </p>
        </BlurIn>
        <BlurIn delay={0.6}>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <a
              href="#"
              className={`${styles.liquidGlassStrong} ${styles.pillStrong}`}
              style={{ borderRadius: 999, padding: "14px 26px", fontSize: 14 }}
            >
              Book a Call <ArrowUpRight size={14} />
            </a>
            <a
              href="#"
              className={styles.btnWhite}
              style={{ padding: "14px 26px", fontSize: 14 }}
            >
              View Pricing
            </a>
          </div>
        </BlurIn>

        <footer
          style={{
            marginTop: 160,
            paddingTop: 32,
            paddingBottom: 32,
            borderTop: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div className={styles.footerGrid}>
            <div>
              <div
                className={styles.fontHeading}
                style={{ fontSize: 32, lineHeight: 1, marginBottom: 12 }}
              >
                Studio
              </div>
              <p className={styles.body} style={{ maxWidth: 320 }}>
                The website your brand deserves — designed by AI, refined by humans, shipped in
                days.
              </p>
            </div>
            {footerCols.map(({ heading, links }) => (
              <div key={heading}>
                <div className={styles.eyebrow} style={{ marginBottom: 14 }}>
                  {heading}
                </div>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    fontSize: 13,
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  {links.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: 24,
              borderTop: "1px dashed rgba(255,255,255,0.18)",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div className={styles.tiny} style={{ color: "rgba(255,255,255,0.4)" }}>
              © 2026 Studio. All rights reserved. · Colophon set in Instrument Serif &amp; Barlow.
            </div>
            <div style={{ display: "flex", gap: 24 }}>
              {["Privacy", "Terms", "Contact"].map((l) => (
                <a
                  key={l}
                  href="#"
                  className={styles.tiny}
                  style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none" }}
                >
                  {l}
                </a>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </section>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div id="studio-landing" className={styles.studioPage}>
      <Masthead />
      <main>
        <Hero />
        <div style={{ background: "#000" }}>
          <ProcessSection />
          <FeaturesChess />
          <PullQuote />
          <WhyUs />
          <Stats />
          <Testimonials />
          <CtaFooter />
        </div>
      </main>
    </div>
  );
}
