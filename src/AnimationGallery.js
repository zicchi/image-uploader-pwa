import React, { useState, useEffect, useRef, useCallback } from "react";

const ANIM_TYPES = [
  { key: "scale", label: "Scale" },
  { key: "rotate", label: "Rotate" },
  { key: "fade", label: "Fade" },
  { key: "scale-rotate", label: "Scale+Rotate" },
  { key: "fade-rotate", label: "Fade+Rotate" },
];

const DURATION = 2; // seconds

const KEYFRAMES = `
@keyframes a-scale {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.3); }
  100% { transform: scale(1); }
}
@keyframes a-rotate {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes a-fade {
  0%   { opacity: 1; }
  50%  { opacity: 0.08; }
  100% { opacity: 1; }
}
@keyframes a-scale-rotate {
  0%   { transform: scale(1) rotate(0deg); }
  50%  { transform: scale(1.3) rotate(180deg); }
  100% { transform: scale(1) rotate(360deg); }
}
@keyframes a-fade-rotate {
  0%   { opacity: 1; transform: rotate(0deg); }
  50%  { opacity: 0.08; transform: rotate(180deg); }
  100% { opacity: 1; transform: rotate(360deg); }
}
`;

const animCSS = {
  scale: `a-scale ${DURATION}s ease-in-out`,
  rotate: `a-rotate ${DURATION}s linear`,
  fade: `a-fade ${DURATION}s ease-in-out`,
  "scale-rotate": `a-scale-rotate ${DURATION}s ease-in-out`,
  "fade-rotate": `a-fade-rotate ${DURATION}s ease-in-out`,
};

export default function AnimationGallery() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [animType, setAnimType] = useState("scale");
  const [playing, setPlaying] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const [metrics, setMetrics] = useState(null);

  const frameRef = useRef(0);
  const rafRef = useRef(null);
  const t0Ref = useRef(0);

  // load manifest
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/assets/30/manifest.json");
        if (!r.ok) throw new Error("Manifest not found");
        const list = await r.json();
        setImages(list.map((f) => ({ name: f, src: `/assets/30/${f}` })));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const startFPS = useCallback(() => {
    frameRef.current = 0;
    t0Ref.current = performance.now();
    const tick = () => {
      frameRef.current++;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopFPS = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const elapsed = performance.now() - t0Ref.current;
    const frames = frameRef.current;
    setMetrics({
      fps: Math.round((frames / elapsed) * 1000),
      frames,
      duration: Math.round(elapsed),
    });
    setPlaying(false);
  }, []);

  const handlePlay = () => {
    setMetrics(null);
    setPlaying(true);
    setPlayKey((k) => k + 1);
    startFPS();
    setTimeout(stopFPS, DURATION * 1000 + 50);
  };

  // ─── styles ───
  const page = {
    minHeight: "100vh",
    background: "#fafafa",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  };
  const header = {
    padding: "20px 16px 12px",
    background: "#fff",
    borderBottom: "1px solid #eee",
  };
  const title = { margin: 0, fontSize: "20px", fontWeight: 700, color: "#111" };
  const subtitle = { margin: "4px 0 0", fontSize: "13px", color: "#888" };

  const pillRow = {
    display: "flex",
    gap: "8px",
    padding: "12px 16px",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
  };
  const pill = (active) => ({
    padding: "8px 14px",
    borderRadius: "20px",
    border: active ? "2px solid #111" : "1px solid #ddd",
    background: active ? "#111" : "#fff",
    color: active ? "#fff" : "#444",
    fontSize: "13px",
    fontWeight: active ? 600 : 400,
    whiteSpace: "nowrap",
    cursor: "pointer",
  });

  const playBtn = {
    margin: "0 16px 12px",
    padding: "12px 0",
    width: "calc(100% - 32px)",
    borderRadius: "12px",
    border: "none",
    background: playing ? "#ccc" : "#111",
    color: "#fff",
    fontSize: "15px",
    fontWeight: 600,
    cursor: playing ? "default" : "pointer",
  };

  const metricsCard = {
    margin: "0 16px 12px",
    padding: "14px 16px",
    borderRadius: "12px",
    background: "#e8f5e9",
    display: "flex",
    justifyContent: "space-around",
    fontSize: "13px",
  };
  const metricVal = { fontWeight: 700, fontSize: "18px", color: "#111" };

  const grid = {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "4px",
    padding: "0 16px 24px",
  };
  const cell = {
    borderRadius: "10px",
    overflow: "hidden",
    background: "#fff",
    border: "1px solid #eee",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "8px 4px 6px",
  };
  const imgBox = (isPlaying) => ({
    width: "90px",
    height: "90px",
    objectFit: "cover",
    borderRadius: "6px",
    animation: isPlaying ? animCSS[animType] : "none",
  });
  const imgLabel = {
    marginTop: "4px",
    fontSize: "11px",
    color: "#888",
    textAlign: "center",
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>Loading images...</div>;
  if (error) return <div style={{ padding: 40, textAlign: "center", color: "red" }}>{error}</div>;

  return (
    <div style={page}>
      <style>{KEYFRAMES}</style>

      <div style={header}>
        <h1 style={title}>Animation Benchmark</h1>
        <p style={subtitle}>{images.length} images from assets/30</p>
      </div>

      {/* animation type selector */}
      <div style={pillRow}>
        {ANIM_TYPES.map((t) => (
          <button
            key={t.key}
            style={pill(animType === t.key)}
            onClick={() => { setAnimType(t.key); setMetrics(null); setPlaying(false); }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* play button */}
      <button style={playBtn} onClick={handlePlay} disabled={playing}>
        {playing ? `Playing ${ANIM_TYPES.find((t) => t.key === animType).label}...` : `Play ${ANIM_TYPES.find((t) => t.key === animType).label}`}
      </button>

      {/* metrics */}
      {metrics && (
        <div style={metricsCard}>
          <div style={{ textAlign: "center" }}>
            <div style={metricVal}>{metrics.fps}</div>
            <div>FPS</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={metricVal}>{metrics.frames}</div>
            <div>Frames</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={metricVal}>{metrics.duration} ms</div>
            <div>Duration</div>
          </div>
        </div>
      )}

      {/* image grid */}
      <div style={grid}>
        {images.map((img) => (
          <div key={`${img.name}-${playKey}`} style={cell}>
            <img
              src={img.src}
              alt={img.name}
              style={imgBox(playing)}
            />
            <div style={imgLabel}>{img.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
