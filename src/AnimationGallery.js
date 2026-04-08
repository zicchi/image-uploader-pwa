import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import picaLib from "pica";
import Resizer from "react-image-file-resizer";

/* ═══ Constants ═══ */
const ANIMS = [
  { key: "scale-fade", label: "Scale+Fade" },
  { key: "rotate-fade", label: "Rotate+Fade" },
  { key: "slide-fade", label: "Slide+Fade" },
  { key: "scale-rotate", label: "Scale+Rotate" },
  { key: "slide-scale", label: "Slide+Scale" },
];
const ANIM_MS = 1500; // faster animation = harder on GPU
const COOLDOWN_MS = 2000;
const MAX_IMAGES = 200;
const STEP = 5; // N increments: 5, 10, 15, ... 200

/*
 * HEAVY animations — setiap keyframe menggabungkan:
 * - transform (scale/rotate/translate)
 * - opacity
 * - filter: blur(8px) + brightness + saturate + contrast
 * - box-shadow (animated, forces repaint)
 * - backdrop-filter via wrapper (extremely heavy)
 *
 * Granular 8-step keyframes (0/14/28/42/57/71/85/100%)
 * untuk beban per-frame lebih realistis.
 */
const KEYFRAMES = `
@keyframes b-scale-fade {
  0%   { transform: scale(1);    opacity: 1;   filter: blur(0px) brightness(1) saturate(1);
         box-shadow: 0 0 0 rgba(0,0,0,0); }
  14%  { transform: scale(1.08); opacity: 0.8; filter: blur(2px) brightness(1.15) saturate(1.3);
         box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
  28%  { transform: scale(1.18); opacity: 0.5; filter: blur(5px) brightness(1.3) saturate(1.6);
         box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
  42%  { transform: scale(1.3);  opacity: 0.2; filter: blur(8px) brightness(1.5) saturate(2);
         box-shadow: 0 12px 48px rgba(0,0,0,0.45); }
  57%  { transform: scale(1.35); opacity: 0.1; filter: blur(10px) brightness(1.6) saturate(2.5);
         box-shadow: 0 16px 60px rgba(0,0,0,0.5); }
  71%  { transform: scale(1.18); opacity: 0.4; filter: blur(5px) brightness(1.3) saturate(1.6);
         box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
  85%  { transform: scale(1.08); opacity: 0.7; filter: blur(2px) brightness(1.1) saturate(1.2);
         box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
  100% { transform: scale(1);    opacity: 1;   filter: blur(0px) brightness(1) saturate(1);
         box-shadow: 0 0 0 rgba(0,0,0,0); }
}

@keyframes b-rotate-fade {
  0%   { transform: rotate(0deg);   opacity: 1;   filter: blur(0px) saturate(1) contrast(1);
         box-shadow: 0 0 0 rgba(0,0,0,0); }
  14%  { transform: rotate(50deg);  opacity: 0.8; filter: blur(2px) saturate(1.5) contrast(1.2);
         box-shadow: 4px 4px 20px rgba(0,0,0,0.2); }
  28%  { transform: rotate(100deg); opacity: 0.5; filter: blur(5px) saturate(2.2) contrast(1.4);
         box-shadow: 8px 8px 36px rgba(0,0,0,0.35); }
  42%  { transform: rotate(160deg); opacity: 0.2; filter: blur(8px) saturate(3) contrast(1.6);
         box-shadow: 10px 10px 48px rgba(0,0,0,0.5); }
  57%  { transform: rotate(220deg); opacity: 0.15; filter: blur(10px) saturate(3.5) contrast(1.8);
         box-shadow: 8px 8px 36px rgba(0,0,0,0.45); }
  71%  { transform: rotate(280deg); opacity: 0.4; filter: blur(5px) saturate(2) contrast(1.3);
         box-shadow: 4px 4px 20px rgba(0,0,0,0.25); }
  85%  { transform: rotate(330deg); opacity: 0.7; filter: blur(2px) saturate(1.3) contrast(1.1);
         box-shadow: 2px 2px 10px rgba(0,0,0,0.1); }
  100% { transform: rotate(360deg); opacity: 1;   filter: blur(0px) saturate(1) contrast(1);
         box-shadow: 0 0 0 rgba(0,0,0,0); }
}

@keyframes b-slide-fade {
  0%   { transform: translateX(0%);  opacity: 1;   filter: blur(0px) contrast(1) brightness(1);
         box-shadow: 0 0 0 rgba(0,0,0,0); }
  14%  { transform: translateX(8%);  opacity: 0.8; filter: blur(2px) contrast(1.2) brightness(1.15);
         box-shadow: -4px 0 20px rgba(0,0,0,0.15); }
  28%  { transform: translateX(18%); opacity: 0.5; filter: blur(5px) contrast(1.5) brightness(1.3);
         box-shadow: -8px 0 36px rgba(0,0,0,0.3); }
  42%  { transform: translateX(28%); opacity: 0.2; filter: blur(8px) contrast(1.8) brightness(1.5);
         box-shadow: -12px 0 48px rgba(0,0,0,0.45); }
  57%  { transform: translateX(22%); opacity: 0.15; filter: blur(10px) contrast(2) brightness(1.6);
         box-shadow: -10px 0 40px rgba(0,0,0,0.4); }
  71%  { transform: translateX(14%); opacity: 0.4; filter: blur(5px) contrast(1.4) brightness(1.2);
         box-shadow: -6px 0 24px rgba(0,0,0,0.2); }
  85%  { transform: translateX(6%);  opacity: 0.7; filter: blur(2px) contrast(1.15) brightness(1.08);
         box-shadow: -3px 0 12px rgba(0,0,0,0.1); }
  100% { transform: translateX(0%);  opacity: 1;   filter: blur(0px) contrast(1) brightness(1);
         box-shadow: 0 0 0 rgba(0,0,0,0); }
}

@keyframes b-scale-rotate {
  0%   { transform: scale(1) rotate(0deg);        filter: blur(0px) brightness(1) contrast(1) saturate(1);
         box-shadow: 0 0 0 rgba(0,0,0,0); }
  14%  { transform: scale(1.08) rotate(50deg);    filter: blur(2px) brightness(1.2) contrast(1.15) saturate(1.3);
         box-shadow: 4px 4px 20px rgba(0,0,0,0.2); }
  28%  { transform: scale(1.18) rotate(100deg);   filter: blur(5px) brightness(1.4) contrast(1.3) saturate(1.8);
         box-shadow: 8px 8px 36px rgba(0,0,0,0.35); }
  42%  { transform: scale(1.3) rotate(160deg);    filter: blur(8px) brightness(1.6) contrast(1.5) saturate(2.2);
         box-shadow: 12px 12px 48px rgba(0,0,0,0.5); }
  57%  { transform: scale(1.35) rotate(220deg);   filter: blur(10px) brightness(1.7) contrast(1.6) saturate(2.8);
         box-shadow: 10px 10px 40px rgba(0,0,0,0.45); }
  71%  { transform: scale(1.18) rotate(280deg);   filter: blur(5px) brightness(1.3) contrast(1.25) saturate(1.6);
         box-shadow: 6px 6px 24px rgba(0,0,0,0.25); }
  85%  { transform: scale(1.06) rotate(330deg);   filter: blur(2px) brightness(1.1) contrast(1.1) saturate(1.2);
         box-shadow: 2px 2px 10px rgba(0,0,0,0.1); }
  100% { transform: scale(1) rotate(360deg);      filter: blur(0px) brightness(1) contrast(1) saturate(1);
         box-shadow: 0 0 0 rgba(0,0,0,0); }
}

@keyframes b-slide-scale {
  0%   { transform: translateX(0%) scale(1);      filter: blur(0px) saturate(1) brightness(1) contrast(1);
         box-shadow: 0 0 0 rgba(0,0,0,0); }
  14%  { transform: translateX(5%) scale(1.08);   filter: blur(2px) saturate(1.5) brightness(1.15) contrast(1.15);
         box-shadow: -4px 4px 20px rgba(0,0,0,0.2); }
  28%  { transform: translateX(12%) scale(1.18);  filter: blur(5px) saturate(2.2) brightness(1.3) contrast(1.3);
         box-shadow: -8px 8px 36px rgba(0,0,0,0.35); }
  42%  { transform: translateX(20%) scale(1.3);   filter: blur(8px) saturate(3) brightness(1.5) contrast(1.5);
         box-shadow: -12px 12px 48px rgba(0,0,0,0.5); }
  57%  { transform: translateX(24%) scale(1.35);  filter: blur(10px) saturate(3.5) brightness(1.6) contrast(1.6);
         box-shadow: -14px 14px 56px rgba(0,0,0,0.5); }
  71%  { transform: translateX(14%) scale(1.18);  filter: blur(5px) saturate(2) brightness(1.25) contrast(1.25);
         box-shadow: -6px 6px 24px rgba(0,0,0,0.25); }
  85%  { transform: translateX(5%) scale(1.06);   filter: blur(2px) saturate(1.3) brightness(1.08) contrast(1.08);
         box-shadow: -2px 2px 10px rgba(0,0,0,0.1); }
  100% { transform: translateX(0%) scale(1);      filter: blur(0px) saturate(1) brightness(1) contrast(1);
         box-shadow: 0 0 0 rgba(0,0,0,0); }
}

@keyframes bd-pulse {
  0%   { backdrop-filter: blur(0px) brightness(1); }
  50%  { backdrop-filter: blur(12px) brightness(1.3); }
  100% { backdrop-filter: blur(0px) brightness(1); }
}
`;

const ANIM_CSS = {
  "scale-fade":   `b-scale-fade ${ANIM_MS}ms ease-in-out`,
  "rotate-fade":  `b-rotate-fade ${ANIM_MS}ms ease-in-out`,
  "slide-fade":   `b-slide-fade ${ANIM_MS}ms ease-in-out`,
  "scale-rotate": `b-scale-rotate ${ANIM_MS}ms ease-in-out`,
  "slide-scale":  `b-slide-scale ${ANIM_MS}ms ease-in-out`,
};

/* ═══ Helpers ═══ */
function getMemMB() {
  if (performance.memory) return +(performance.memory.usedJSHeapSize / 1048576).toFixed(2);
  return null;
}

function rifrToBlob(file, w, h) {
  return new Promise((resolve) => {
    Resizer.imageFileResizer(file, w, h, "JPEG", 80, 0, resolve, "blob");
  });
}

function exportCSV(rows) {
  const cols = "N,Method,Anim,FPS,Frames,AvgMs,Dropped,Jank%,MemMB,DeltaMemMB,LongTasks,ResizeMs";
  const lines = [cols];
  for (const r of rows) {
    lines.push(
      [r.n, r.method, r.anim, r.fps, r.frames, r.avgMs, r.dropped, r.jank,
       r.memAfter ?? "", r.memDelta ?? "", r.longTasks, r.resizeMs].join(",")
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `anim-bench-${Date.now()}.csv`;
  a.click();
}

/* ═══ Component ═══ */
export default function AnimationGallery() {
  const pica = useMemo(() => picaLib({ features: ["wasm", "ww", "js"] }), []);

  const [allFiles, setAllFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [count, setCount] = useState(10);
  const [method, setMethod] = useState("pica");
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState("");
  const [displayUrls, setDisplayUrls] = useState([]);
  const [activeAnim, setActiveAnim] = useState(null);
  const [animKey, setAnimKey] = useState(0);
  const [results, setResults] = useState([]);
  const [sweepResults, setSweepResults] = useState([]);
  const [sweeping, setSweeping] = useState(false);

  const cancelRef = useRef(false);
  const rafRef = useRef(null);
  const ftRef = useRef([]);
  const ltRef = useRef([]);
  const obsRef = useRef(null);

  /* ── load 200 files on mount ── */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/assets/200/manifest.json");
        const names = await r.json();
        setPhase && setLoadingFiles(true);
        const files = [];
        for (const name of names) {
          const res = await fetch(`/assets/200/${name}`);
          if (!res.ok) continue;
          const blob = await res.blob();
          if (blob.size) files.push(new File([blob], name, { type: blob.type }));
        }
        setAllFiles(files);
      } catch (e) {
        console.error("Failed to load assets:", e);
      } finally {
        setLoadingFiles(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── pica resize (Hamming filter) ── */
  const picaResize = useCallback(
    async (file, maxW, maxH) => {
      const img = new Image();
      const u = URL.createObjectURL(file);
      await new Promise((ok, err) => { img.onload = ok; img.onerror = err; img.src = u; });
      URL.revokeObjectURL(u);

      let w = img.naturalWidth, h = img.naturalHeight;
      const ratio = Math.min(maxW / w, maxH / h, 1);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);

      const src = document.createElement("canvas");
      src.width = img.naturalWidth;
      src.height = img.naturalHeight;
      src.getContext("2d").drawImage(img, 0, 0);

      const dst = document.createElement("canvas");
      dst.width = w;
      dst.height = h;

      await pica.resize(src, dst, { filter: "hamming" });
      return await pica.toBlob(dst, "image/jpeg", 0.8);
    },
    [pica]
  );

  /* ── FPS + jank measurement ── */
  function startMeasure() {
    ftRef.current = [];
    ltRef.current = [];
    let last = performance.now();
    try {
      obsRef.current = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) ltRef.current.push(e.duration);
      });
      obsRef.current.observe({ entryTypes: ["longtask"] });
    } catch (e) {}
    const tick = (now) => {
      ftRef.current.push(now - last);
      last = now;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function stopMeasure() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (obsRef.current) {
      obsRef.current.disconnect();
      obsRef.current = null;
    }
    const ft = ftRef.current;
    if (!ft.length) return { fps: 0, frames: 0, avgMs: 0, dropped: 0, jank: 0, longTasks: 0 };
    const avg = ft.reduce((a, b) => a + b, 0) / ft.length;
    const dropped = ft.filter((t) => t > 33.33).length;
    return {
      fps: Math.round(1000 / avg),
      frames: ft.length,
      avgMs: +avg.toFixed(2),
      dropped,
      jank: +((dropped / ft.length) * 100).toFixed(1),
      longTasks: ltRef.current.length,
    };
  }

  /* ── run benchmark for N images ── */
  const runBench = useCallback(
    async (n, m) => {
      const files = allFiles.slice(0, n);
      if (!files.length) return [];
      setRunning(true);
      setResults([]);
      setDisplayUrls([]);

      // 1) resize
      const t0 = performance.now();
      const blobs = [];
      for (let i = 0; i < files.length; i++) {
        if (cancelRef.current) break;
        setPhase(`Resize ${i + 1}/${n} (${m.toUpperCase()})`);
        const blob =
          m === "pica"
            ? await picaResize(files[i], 800, 600)
            : await rifrToBlob(files[i], 800, 600);
        blobs.push(blob);
      }
      const resizeMs = Math.round(performance.now() - t0);

      const blobUrls = blobs.map((b) =>
        b instanceof Blob ? URL.createObjectURL(b) : b
      );
      setDisplayUrls(blobUrls);

      // 2) animate 5 types with cooldown
      const rows = [];
      for (let ai = 0; ai < ANIMS.length; ai++) {
        if (cancelRef.current) break;
        const { key, label } = ANIMS[ai];

        if (ai > 0) {
          setPhase(`Cooldown ${COOLDOWN_MS / 1000}s...`);
          setActiveAnim(null);
          await new Promise((r) => setTimeout(r, COOLDOWN_MS));
        }

        if (cancelRef.current) break;
        setPhase(`${label} — ${n} images`);
        setActiveAnim(key);
        setAnimKey((k) => k + 1);

        const mb = getMemMB();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        startMeasure();
        await new Promise((r) => setTimeout(r, ANIM_MS + 100));
        const metrics = stopMeasure();
        const ma = getMemMB();

        rows.push({
          n,
          method: m,
          anim: key,
          ...metrics,
          memBefore: mb,
          memAfter: ma,
          memDelta: mb != null && ma != null ? +(ma - mb).toFixed(2) : null,
          resizeMs,
        });
        setResults([...rows]);
      }

      setActiveAnim(null);
      blobUrls.forEach((u) => {
        try { URL.revokeObjectURL(u); } catch (e) {}
      });
      setPhase("Done");
      setRunning(false);
      return rows;
    },
    [allFiles, picaResize]
  );

  /* ── sweep 5,10,15...200 ── */
  const runSweep = useCallback(async () => {
    cancelRef.current = false;
    setSweeping(true);
    setSweepResults([]);
    for (let n = STEP; n <= MAX_IMAGES; n += STEP) {
      if (cancelRef.current) break;
      const rows = await runBench(n, method);
      setSweepResults((prev) => [...prev, ...rows]);
    }
    setSweeping(false);
  }, [runBench, method]);

  const handleStop = () => { cancelRef.current = true; };
  const busy = running || sweeping;

  const cores = navigator.hardwareConcurrency || "?";
  const devRam = navigator.deviceMemory ? `${navigator.deviceMemory} GB` : "N/A";

  if (loadingFiles)
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>
        Loading {MAX_IMAGES} images...
      </div>
    );

  return (
    <div style={S.page}>
      <style>{KEYFRAMES}</style>

      <div style={S.header}>
        <h1 style={S.title}>Animation Benchmark</h1>
        <div style={S.sub}>
          {cores} cores · RAM {devRam} · {allFiles.length}/{MAX_IMAGES} images loaded
        </div>
        <div style={S.sub2}>
          blur(10px) + box-shadow + backdrop-filter + brightness/saturate/contrast
        </div>
      </div>

      <div style={S.controls}>
        <div style={{ marginBottom: 12 }}>
          <div style={S.label}>
            Images: <b>{count}</b>
            <span style={{ color: "#aaa", marginLeft: 8, fontSize: 12 }}>
              (step {STEP}, max {MAX_IMAGES})
            </span>
          </div>
          <input
            type="range" min={STEP} max={MAX_IMAGES} step={STEP} value={count}
            onChange={(e) => setCount(+e.target.value)}
            disabled={busy}
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {["pica", "rifr"].map((m) => (
            <button
              key={m}
              style={S.toggle(method === m)}
              onClick={() => setMethod(m)}
              disabled={busy}
            >
              {m === "pica" ? "PICA (Hamming)" : "RIFR"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={S.action("#111")}
            onClick={() => { cancelRef.current = false; runBench(count, method); }}
            disabled={busy}
          >
            Run ({count})
          </button>
          <button
            style={S.action("#2563eb")}
            onClick={runSweep}
            disabled={busy}
          >
            Sweep 5→200
          </button>
          {busy && (
            <button style={S.action("#dc2626")} onClick={handleStop}>
              Stop
            </button>
          )}
        </div>
      </div>

      {phase && <div style={S.phase}>{phase}</div>}

      {/* image grid with backdrop-filter overlay */}
      {displayUrls.length > 0 && (
        <div style={S.grid(displayUrls.length)}>
          {displayUrls.map((u, i) => (
            <div
              key={`${i}-${animKey}`}
              style={{
                position: "relative",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <img
                src={u}
                alt=""
                style={{
                  width: "100%",
                  aspectRatio: "4/3",
                  objectFit: "cover",
                  display: "block",
                  animation: activeAnim ? ANIM_CSS[activeAnim] : "none",
                }}
              />
              {/* backdrop-filter overlay — extremely heavy */}
              {activeAnim && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    animation: `bd-pulse ${ANIM_MS}ms ease-in-out`,
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {results.length > 0 && !sweeping && <Table rows={results} />}

      {sweepResults.length > 0 && (
        <>
          <div style={{ padding: "8px 16px", display: "flex", gap: 8 }}>
            <button
              style={S.action("#16a34a")}
              onClick={() => exportCSV(sweepResults)}
            >
              Export CSV ({sweepResults.length} rows)
            </button>
          </div>
          <Table rows={sweepResults} />
        </>
      )}
    </div>
  );
}

/* ═══ Results Table ═══ */
function Table({ rows }) {
  const cols = [
    "N", "Method", "Anim", "FPS", "Frames", "Avg ms",
    "Drop", "Jank%", "RAM MB", "ΔRAM", "Tasks", "Resize ms",
  ];
  return (
    <div style={{ padding: "0 16px 24px", overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 8 }}>
        <thead>
          <tr>
            {cols.map((h) => (
              <th key={h} style={S.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={i % 2 ? { background: "#f9f9f9" } : {}}>
              <td style={S.td}>{r.n}</td>
              <td style={S.td}>{r.method}</td>
              <td style={S.td}>{r.anim}</td>
              <td
                style={{
                  ...S.td,
                  fontWeight: 700,
                  color: r.fps >= 55 ? "#16a34a" : r.fps >= 30 ? "#ca8a04" : "#dc2626",
                }}
              >
                {r.fps}
              </td>
              <td style={S.td}>{r.frames}</td>
              <td style={S.td}>{r.avgMs}</td>
              <td style={S.td}>{r.dropped}</td>
              <td style={S.td}>{r.jank}%</td>
              <td style={S.td}>{r.memAfter ?? "N/A"}</td>
              <td style={S.td}>
                {r.memDelta != null
                  ? (r.memDelta > 0 ? "+" : "") + r.memDelta
                  : "N/A"}
              </td>
              <td style={S.td}>{r.longTasks}</td>
              <td style={S.td}>{r.resizeMs}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ═══ Styles ═══ */
const S = {
  page: {
    minHeight: "100vh",
    background: "#fafafa",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  header: { padding: "20px 16px 12px", background: "#fff", borderBottom: "1px solid #eee" },
  title: { margin: 0, fontSize: 20, fontWeight: 700 },
  sub: { marginTop: 4, fontSize: 12, color: "#888" },
  sub2: { marginTop: 2, fontSize: 11, color: "#b0b0b0", fontStyle: "italic" },
  controls: { padding: 16 },
  label: { fontSize: 14, marginBottom: 4, color: "#444" },
  toggle: (on) => ({
    flex: 1,
    padding: 10,
    borderRadius: 10,
    border: on ? "2px solid #111" : "1px solid #ddd",
    background: on ? "#111" : "#fff",
    color: on ? "#fff" : "#444",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  }),
  action: (bg) => ({
    flex: 1,
    padding: 12,
    borderRadius: 10,
    border: "none",
    background: bg,
    color: "#fff",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  }),
  phase: {
    margin: "0 16px 12px",
    padding: "10px 14px",
    borderRadius: 10,
    background: "#fef3c7",
    fontSize: 13,
    fontWeight: 500,
    color: "#92400e",
  },
  grid: (n) => ({
    display: "grid",
    gridTemplateColumns: `repeat(${n <= 4 ? 2 : n <= 12 ? 3 : n <= 30 ? 5 : n <= 80 ? 8 : 10}, 1fr)`,
    gap: 2,
    padding: "0 16px 12px",
  }),
  th: {
    padding: "8px 6px",
    textAlign: "left",
    borderBottom: "2px solid #ddd",
    fontWeight: 600,
    fontSize: 11,
    color: "#666",
    whiteSpace: "nowrap",
  },
  td: { padding: "6px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" },
};
