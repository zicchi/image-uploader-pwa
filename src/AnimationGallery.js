import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import picaLib from "pica";
import Resizer from "react-image-file-resizer";

/* ═══ Product data ═══ */
const NAMES = [
  "Wireless Earbuds Pro","Smart Watch Ultra","Silicone Phone Case",
  "USB-C Cable 2m","Laptop Stand Ergo","RGB Mouse Pad XL",
  "Webcam 1080p HD","Power Bank 20000mAh","LED Desk Lamp",
  "BT Speaker Mini","Mech Keyboard RGB","Monitor Arm Dual",
  "Laptop Sleeve 14\"","Tempered Glass Film","Car Phone Holder",
  "Wireless Charger Pad","Portable SSD 1TB","Gaming Mouse Pro",
  "Tablet Stylus Pen","HDMI Cable 4K","Ring Light 10\"",
  "Action Camera 4K","NC Headset Pro","Smart Plug WiFi",
  "Cable Organizer Box","Tripod Stand 170cm","External Battery",
  "USB Hub 7-Port","Cooling Pad Laptop","Mini Projector HD",
  "Fitness Tracker Band","Dash Cam 2K","Air Purifier Mini",
  "Desk Organizer Wood","Phone Gimbal 3-Axis","Smart Light Bulb",
  "VR Headset Basic","Thermal Printer Mini","WiFi Range Extender",
  "Portable Fan USB",
];
function genProduct(i) {
  return {
    name: NAMES[i % NAMES.length],
    price: (15 + ((i * 7 + 3) % 485)) * 1000,
    rating: 3 + (i % 3),
    sold: 50 + ((i * 17) % 9950),
  };
}
function fmtPrice(n) { return "Rp " + n.toLocaleString("id-ID"); }
function stars(n) { return "\u2605".repeat(n) + "\u2606".repeat(5 - n); }

/* ═══ Constants ═══ */
const ANIMS = [
  { key: "scale-fade", label: "Scale + Fade" },
  { key: "rotate-fade", label: "Rotate + Fade" },
  { key: "slide-fade", label: "Slide + Fade" },
  { key: "scale-rotate", label: "Scale + Rotate" },
  { key: "slide-scale", label: "Slide + Scale" },
];
const ANIM_MS = 3000;
const COOLDOWN_MS = 2000;
const MAX_IMG = 200;
const STEP = 5;
const ANIM_TARGETS = [
  { key: "all", label: "All Items" },
  { key: "visible", label: "Visible Only" },
];

/* ═══ GPU detection (works on mobile: Adreno, Mali, Apple GPU) ═══ */
function getGPUInfo() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
    if (!gl) return { vendor: "N/A", renderer: "N/A" };
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (!ext) return { vendor: "N/A", renderer: "N/A" };
    return {
      vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL),
      renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),
    };
  } catch (e) {
    return { vendor: "N/A", renderer: "N/A" };
  }
}

/* ═══ Percentile ═══ */
function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * p / 100) - 1;
  return +sorted[Math.max(0, idx)].toFixed(2);
}

/* ═══ Page-load FCP (once) ═══ */
function getFCP() {
  try {
    const e = performance.getEntriesByName("first-contentful-paint");
    return e.length ? Math.round(e[0].startTime) : null;
  } catch (e) { return null; }
}

/* ═══ TTR: Time-to-Render (per run) ═══
 * Measures time from Refresh click → all images decoded & painted.
 * Uses requestAnimationFrame + Image.decode() chain so it fires
 * only after the browser has actually composited the frame.
 */
async function measureTTR(startMark, imgEls) {
  try {
    // Wait for all images to decode (GPU texture upload)
    await Promise.all([...imgEls].map(img =>
      img.complete ? Promise.resolve() : img.decode().catch(() => {})
    ));
    // One more rAF to ensure paint happened
    await new Promise(r => requestAnimationFrame(r));
    return Math.round(performance.now() - startMark);
  } catch (e) { return null; }
}

/* ═══ Layout-thrashing JS animation ═══ */
function applyAnimFrame(el, type, p, t) {
  const blur = 10 * p;
  const bright = 1 + 0.6 * p;
  const sat = 1 + 2.5 * p;
  const ctrst = 1 + 0.6 * p;
  const sh = 60 * p;
  const pad = Math.round(8 * p);
  const mar = Math.round(6 * p);
  const bw = Math.round(4 * p);
  const wDelta = Math.round(20 * p);
  const hDelta = Math.round(15 * p);

  switch (type) {
    case "scale-fade":
      el.style.width = `calc(100% - ${wDelta}px)`;
      el.style.height = `calc(180px + ${hDelta}px)`;
      el.style.padding = `${pad}px`;
      el.style.margin = `${mar}px`;
      el.style.borderWidth = `${bw}px`;
      void el.offsetHeight;
      el.style.filter = `blur(${blur}px) brightness(${bright}) saturate(${sat})`;
      el.style.boxShadow = `0 ${sh / 4}px ${sh}px rgba(0,0,0,${0.5 * p})`;
      break;
    case "rotate-fade":
      el.style.width = `calc(100% + ${wDelta}px)`;
      el.style.height = `calc(180px - ${hDelta}px)`;
      el.style.padding = `${pad + 2}px`;
      el.style.margin = `${mar + 1}px`;
      el.style.borderWidth = `${bw + 1}px`;
      void el.offsetHeight;
      el.style.filter = `blur(${blur}px) saturate(${sat}) contrast(${ctrst})`;
      el.style.boxShadow = `${sh / 4}px ${sh / 4}px ${sh}px rgba(0,0,0,${0.5 * p})`;
      break;
    case "slide-fade":
      el.style.width = `calc(100% - ${wDelta / 2}px)`;
      el.style.height = `calc(180px + ${hDelta * 2}px)`;
      el.style.paddingLeft = `${pad * 3}px`;
      el.style.marginRight = `${mar * 2}px`;
      el.style.borderWidth = `${bw}px`;
      void el.offsetHeight;
      el.style.filter = `blur(${blur}px) contrast(${ctrst}) brightness(${bright})`;
      el.style.boxShadow = `${-sh / 3}px 0 ${sh}px rgba(0,0,0,${0.4 * p})`;
      break;
    case "scale-rotate":
      el.style.width = `calc(100% + ${wDelta * 1.5}px)`;
      el.style.height = `calc(180px + ${hDelta}px)`;
      el.style.padding = `${pad * 2}px`;
      el.style.margin = `${mar}px`;
      el.style.borderWidth = `${bw + 2}px`;
      void el.offsetHeight;
      el.style.filter = `blur(${blur}px) brightness(${bright}) contrast(${ctrst}) saturate(${sat})`;
      el.style.boxShadow = `${sh / 4}px ${sh / 4}px ${sh}px rgba(0,0,0,${0.5 * p})`;
      break;
    case "slide-scale":
      el.style.width = `calc(100% - ${wDelta * 2}px)`;
      el.style.height = `calc(180px - ${hDelta / 2}px)`;
      el.style.paddingTop = `${pad * 2}px`;
      el.style.marginBottom = `${mar * 3}px`;
      el.style.borderWidth = `${bw + 1}px`;
      void el.offsetHeight;
      el.style.filter = `blur(${blur}px) saturate(${sat}) brightness(${bright}) contrast(${ctrst})`;
      el.style.boxShadow = `${-sh / 3}px ${sh / 4}px ${sh}px rgba(0,0,0,${0.5 * p})`;
      break;
    default: break;
  }
}

function resetElStyles(el) {
  el.style.transform = "";
  el.style.opacity = "";
  el.style.filter = "";
  el.style.boxShadow = "";
  el.style.width = "";
  el.style.height = "";
  el.style.padding = "";
  el.style.paddingLeft = "";
  el.style.paddingTop = "";
  el.style.margin = "";
  el.style.marginRight = "";
  el.style.marginBottom = "";
  el.style.borderWidth = "";
}

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
function buildCSV(rows, gpu) {
  const cols = [
    "N","Method","Anim","Target","FPS","Frames","AvgMs","Dropped","Jank%",
    "P50ms","P95ms","P99ms","MaxFrameMs","LongTasks","TBT_ms","CLS",
    "AnimCount","PaintDurationMs","ResizeMs","TTR_ms",
    "MemBeforeMB","MemAfterMB","MemDeltaMB",
    "FCP_ms","GPU","Cores","DeviceMemGB",
  ].join(",");
  const lines = [cols];
  for (const r of rows) {
    lines.push([
      r.n, r.method, r.anim, r.target, r.fps, r.frames, r.avgMs, r.dropped, r.jank,
      r.p50, r.p95, r.p99, r.maxFrameMs, r.longTasks, r.tbt, r.cls,
      r.animatedCount, r.paintDuration, r.resizeMs, r.ttr ?? "",
      r.memBefore ?? "", r.memAfter ?? "", r.memDelta ?? "",
      r.fcp ?? "", `"${gpu.renderer}"`, r.cores, r.deviceMemory,
    ].join(","));
  }
  return lines.join("\n");
}

async function exportCSV(rows, gpu) {
  const csv = buildCSV(rows, gpu);
  const fileName = `shopbench-${Date.now()}.csv`;
  const blob = new Blob([csv], { type: "text/csv" });

  // Web Share API — works on Android Chrome & iOS Safari (share sheet)
  if (navigator.share && navigator.canShare) {
    const file = new File([blob], fileName, { type: "text/csv" });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "ShopBench Results", text: `${rows.length} benchmark rows` });
      return;
    }
  }
  // Fallback: direct download (desktop)
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
}

/* ═══ Component ═══ */
export default function AnimationGallery() {
  const pica = useMemo(() => picaLib({ features: ["wasm", "ww", "js"] }), []);
  const [gpu] = useState(() => getGPUInfo());

  /* manifest */
  const [fileNames, setFileNames] = useState([]);
  const [ready, setReady] = useState(false);

  /* settings */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [animType, setAnimType] = useState("scale-fade");
  const [method, setMethod] = useState("pica");
  const [count, setCount] = useState(10);
  const [animTarget, setAnimTarget] = useState("all");

  /* bench state */
  const [running, setRunning] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [phase, setPhase] = useState("");
  const [products, setProducts] = useState([]);
  const [lastMetrics, setLastMetrics] = useState(null);
  const [results, setResults] = useState([]);
  const [sweepResults, setSweepResults] = useState([]);

  /* refs */
  const cancelRef = useRef(false);
  const rafRef = useRef(null);
  const ftRef = useRef([]);
  const ltRef = useRef([]);
  const obsRef = useRef(null);
  const gridRef = useRef(null);
  const animStartRef = useRef(0);

  /* ── fetch manifest on mount ── */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/assets/200/manifest.json");
        setFileNames(await r.json());
      } catch (e) { console.error("Failed to load manifest:", e); }
      finally { setReady(true); }
    })();
  }, []);

  /* ── visible card tracking ── */
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { e.target.dataset.visible = e.isIntersecting ? "true" : "false"; });
    }, { threshold: 0.1 });
    const obs = (root) => root.querySelectorAll("[data-card]").forEach(c => io.observe(c));
    obs(grid);
    const mo = new MutationObserver((muts) => {
      muts.forEach(m => m.addedNodes.forEach(n => {
        if (n.nodeType === 1) {
          if (n.dataset?.card !== undefined) io.observe(n);
          if (n.querySelectorAll) obs(n);
        }
      }));
    });
    mo.observe(grid, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, [ready]);

  /* ── pica resize (Hamming) ── */
  const picaResize = useCallback(async (file, maxW, maxH) => {
    const img = new Image();
    const u = URL.createObjectURL(file);
    await new Promise((ok, err) => { img.onload = ok; img.onerror = err; img.src = u; });
    URL.revokeObjectURL(u);
    let w = img.naturalWidth, h = img.naturalHeight;
    const ratio = Math.min(maxW / w, maxH / h, 1);
    w = Math.round(w * ratio); h = Math.round(h * ratio);
    const src = document.createElement("canvas");
    src.width = img.naturalWidth; src.height = img.naturalHeight;
    src.getContext("2d").drawImage(img, 0, 0);
    const dst = document.createElement("canvas");
    dst.width = w; dst.height = h;
    await pica.resize(src, dst, { filter: "hamming" });
    return await pica.toBlob(dst, "image/jpeg", 0.8);
  }, [pica]);

  /* ── JS animation + full metrics collection ── */
  function runJSAnimation(type, target) {
    return new Promise((resolve) => {
      ftRef.current = []; ltRef.current = [];
      const clsEntries = [];
      animStartRef.current = performance.now();
      let lastFrame = animStartRef.current;
      let animatedCount = 0;

      try {
        obsRef.current = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) ltRef.current.push(e.duration);
        });
        obsRef.current.observe({ entryTypes: ["longtask"] });
      } catch (e) {}

      let clsObs = null;
      try {
        clsObs = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) if (!e.hadRecentInput) clsEntries.push(e.value);
        });
        clsObs.observe({ type: "layout-shift", buffered: false });
      } catch (e) {}

      const getImgs = () => {
        const g = gridRef.current;
        if (!g) return [];
        return target === "visible"
          ? g.querySelectorAll('[data-visible="true"] img')
          : g.querySelectorAll("img");
      };

      const tick = (now) => {
        ftRef.current.push(now - lastFrame);
        lastFrame = now;
        const elapsed = now - animStartRef.current;
        const t = Math.min(elapsed / ANIM_MS, 1);
        const p = Math.abs(Math.sin(t * Math.PI * 3));

        const imgs = getImgs();
        animatedCount = imgs.length;
        imgs.forEach((img) => {
          applyAnimFrame(img, type, p, t);
          const card = img.closest("[data-card]");
          if (card) {
            card.style.padding = `${Math.round(4 * p)}px`;
            void card.offsetWidth;
            card.style.borderWidth = `${Math.round(3 * p)}px`;
          }
        });

        if (t < 1 && !cancelRef.current) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          if (obsRef.current) { obsRef.current.disconnect(); obsRef.current = null; }
          if (clsObs) clsObs.disconnect();
          gridRef.current?.querySelectorAll("img").forEach((img) => {
            resetElStyles(img);
            const card = img.closest("[data-card]");
            if (card) { card.style.padding = ""; card.style.borderWidth = ""; }
          });

          const ft = ftRef.current;
          const avg = ft.length ? ft.reduce((a, b) => a + b, 0) / ft.length : 0;
          const dropped = ft.filter((f) => f > 33.33).length;
          resolve({
            fps: avg > 0 ? Math.round(1000 / avg) : 0,
            frames: ft.length,
            avgMs: +avg.toFixed(2),
            dropped,
            jank: ft.length ? +((dropped / ft.length) * 100).toFixed(1) : 0,
            p50: percentile(ft, 50),
            p95: percentile(ft, 95),
            p99: percentile(ft, 99),
            maxFrameMs: ft.length ? +Math.max(...ft).toFixed(2) : 0,
            longTasks: ltRef.current.length,
            tbt: +ltRef.current.reduce((s, d) => s + Math.max(0, d - 50), 0).toFixed(1),
            cls: +clsEntries.reduce((s, v) => s + v, 0).toFixed(4),
            animatedCount,
            paintDuration: Math.round(performance.now() - animStartRef.current),
          });
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    });
  }

  /* ── single refresh ── */
  const runRefresh = useCallback(async () => {
    const names = fileNames.slice(0, count);
    if (!names.length) return;
    cancelRef.current = false;
    setRunning(true); setProducts([]); setLastMetrics(null);
    setPhase(`Loading ${count} products...`);

    const t0 = performance.now();
    const ttrStart = performance.now();
    const items = [];
    for (let i = 0; i < names.length; i++) {
      if (cancelRef.current) break;
      setPhase(`Resizing ${i + 1}/${count}`);
      try {
        const res = await fetch(`/assets/200/${names[i]}`);
        if (!res.ok) continue;
        const blob = await res.blob();
        const file = new File([blob], names[i], { type: blob.type });
        const resized = method === "pica"
          ? await picaResize(file, 800, 600)
          : await rifrToBlob(file, 800, 600);
        const url = resized instanceof Blob ? URL.createObjectURL(resized) : resized;
        items.push({ ...genProduct(i), url });
      } catch (e) {}
    }
    const resizeMs = Math.round(performance.now() - t0);
    if (cancelRef.current) { setRunning(false); setPhase(""); return; }

    setProducts(items);
    setPhase(`Animating ${ANIMS.find(a => a.key === animType).label}...`);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    // TTR: time from click → all images decoded & painted
    const imgEls = gridRef.current?.querySelectorAll("img") ?? [];
    const ttr = await measureTTR(ttrStart, imgEls);

    const mb = getMemMB();
    const fcp = getFCP(); // page-load FCP (fixed, reference only)
    const metrics = await runJSAnimation(animType, animTarget);
    const ma = getMemMB();

    const row = {
      n: count, method, anim: animType, target: animTarget,
      ...metrics,
      memBefore: mb, memAfter: ma,
      memDelta: mb != null && ma != null ? +(ma - mb).toFixed(2) : null,
      resizeMs, ttr, fcp,
      cores: navigator.hardwareConcurrency || 0,
      deviceMemory: navigator.deviceMemory || 0,
    };
    setLastMetrics(row);
    setResults(prev => [...prev, row]);
    setPhase(""); setRunning(false);
  }, [fileNames, count, method, animType, animTarget, picaResize]);

  /* ── sweep 5→200 × all anims ── */
  const runSweep = useCallback(async () => {
    cancelRef.current = false;
    setSweeping(true); setSweepResults([]);

    for (let n = STEP; n <= MAX_IMG; n += STEP) {
      if (cancelRef.current) break;
      const names = fileNames.slice(0, n);
      if (!names.length) break;
      setProducts([]); setPhase(`Sweep: resizing ${n} images...`);

      const t0 = performance.now();
      const ttrStart = performance.now();
      const items = [];
      for (let i = 0; i < names.length; i++) {
        if (cancelRef.current) break;
        setPhase(`Sweep ${n}: resize ${i + 1}/${n}`);
        try {
          const res = await fetch(`/assets/200/${names[i]}`);
          if (!res.ok) continue;
          const blob = await res.blob();
          const file = new File([blob], names[i], { type: blob.type });
          const resized = method === "pica"
            ? await picaResize(file, 800, 600)
            : await rifrToBlob(file, 800, 600);
          const url = resized instanceof Blob ? URL.createObjectURL(resized) : resized;
          items.push({ ...genProduct(i), url });
        } catch (e) {}
      }
      const resizeMs = Math.round(performance.now() - t0);
      setProducts(items);

      // TTR per N: time from start → all images decoded & painted
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const imgEls = gridRef.current?.querySelectorAll("img") ?? [];
      const ttr = await measureTTR(ttrStart, imgEls);

      for (let ai = 0; ai < ANIMS.length; ai++) {
        if (cancelRef.current) break;
        const { key, label } = ANIMS[ai];
        if (ai > 0) {
          setPhase("Cooldown..."); await new Promise(r => setTimeout(r, COOLDOWN_MS));
        }
        if (cancelRef.current) break;
        setPhase(`Sweep ${n}: ${label}`);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const mb = getMemMB();
        const metrics = await runJSAnimation(key, animTarget);
        const ma = getMemMB();
        setSweepResults(prev => [...prev, {
          n, method, anim: key, target: animTarget,
          ...metrics,
          memBefore: mb, memAfter: ma,
          memDelta: mb != null && ma != null ? +(ma - mb).toFixed(2) : null,
          resizeMs, ttr, fcp: getFCP(),
          cores: navigator.hardwareConcurrency || 0,
          deviceMemory: navigator.deviceMemory || 0,
        }]);
      }
      items.forEach(p => { try { URL.revokeObjectURL(p.url); } catch(e){} });
    }
    setPhase("Sweep done!"); setSweeping(false);
  }, [fileNames, method, animTarget, picaResize]);

  const handleStop = () => {
    cancelRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (obsRef.current) { obsRef.current.disconnect(); obsRef.current = null; }
    setRunning(false); setSweeping(false); setPhase("");
  };

  const busy = running || sweeping;
  const cores = navigator.hardwareConcurrency || "?";
  const devRam = navigator.deviceMemory ? `${navigator.deviceMemory} GB` : "N/A";
  const gpuShort = gpu.renderer.length > 30 ? gpu.renderer.slice(0, 28) + "…" : gpu.renderer;

  if (!ready)
    return <div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>Loading manifest...</div>;

  return (
    <div style={S.page}>
      {/* ── top bar ── */}
      <div style={S.topBar}>
        <button style={S.hamburger} onClick={() => setDrawerOpen(true)}>
          <span style={S.hamLine}/><span style={S.hamLine}/><span style={S.hamLine}/>
        </button>
        <h1 style={S.logo}>ShopBench</h1>
        <div style={S.deviceBadge}>{cores}c · {devRam}</div>
      </div>

      {/* ── GPU bar ── */}
      <div style={S.gpuBar}>GPU: {gpuShort}</div>

      {/* ── action bar ── */}
      <div style={S.actionBar}>
        <button style={S.refreshBtn}
          onClick={() => { cancelRef.current = false; runRefresh(); }}
          disabled={busy}>
          {running ? "Loading..." : "Refresh"}
        </button>
        <div style={S.countPill}>{count} items</div>
        {busy && <button style={S.stopBtn} onClick={handleStop}>Stop</button>}
      </div>

      {/* ── phase ── */}
      {phase && <div style={S.phase}>{phase}</div>}

      {/* ── metrics banner (2 rows) ── */}
      {lastMetrics && !phase && (
        <>
          <div style={S.metricsBanner}>
            <MetricChip label="FPS" value={lastMetrics.fps}
              color={lastMetrics.fps >= 55 ? "#16a34a" : lastMetrics.fps >= 30 ? "#ca8a04" : "#dc2626"} />
            <MetricChip label="Jank" value={lastMetrics.jank + "%"}
              color={lastMetrics.jank <= 1 ? "#16a34a" : lastMetrics.jank <= 5 ? "#ca8a04" : "#dc2626"} />
            <MetricChip label="P95" value={lastMetrics.p95 + "ms"}
              color={lastMetrics.p95 <= 16.67 ? "#16a34a" : lastMetrics.p95 <= 33.33 ? "#ca8a04" : "#dc2626"} />
            <MetricChip label="TBT" value={lastMetrics.tbt + "ms"}
              color={lastMetrics.tbt <= 50 ? "#16a34a" : lastMetrics.tbt <= 200 ? "#ca8a04" : "#dc2626"} />
          </div>
          <div style={S.metricsBanner}>
            <MetricChip label="CLS" value={lastMetrics.cls}
              color={lastMetrics.cls <= 0.1 ? "#16a34a" : lastMetrics.cls <= 0.25 ? "#ca8a04" : "#dc2626"} />
            <MetricChip label="RAM" value={(lastMetrics.memAfter ?? "N/A") + " MB"} color="#6366f1" />
            <MetricChip label="Resize" value={lastMetrics.resizeMs + "ms"} color="#888" />
            <MetricChip label="Max" value={lastMetrics.maxFrameMs + "ms"}
              color={lastMetrics.maxFrameMs <= 33 ? "#16a34a" : lastMetrics.maxFrameMs <= 100 ? "#ca8a04" : "#dc2626"} />
          </div>
          <div style={S.metricsDetail}>
            TTR: {lastMetrics.ttr ?? "N/A"}ms · FCP(pg): {lastMetrics.fcp ?? "N/A"}ms
            · P50: {lastMetrics.p50}ms · P99: {lastMetrics.p99}ms
            · LongTasks: {lastMetrics.longTasks} · Anim: {lastMetrics.animatedCount}
            · Duration: {lastMetrics.paintDuration}ms
          </div>
        </>
      )}

      {/* ── product grid ── */}
      <div style={S.grid} ref={gridRef}>
        {products.map((p, i) => (
          <div key={i} style={S.card} data-card data-visible="false">
            <div style={S.imgWrap}>
              <img src={p.url} alt="" style={S.cardImg} />
            </div>
            <div style={S.cardBody}>
              <div style={S.prodName}>{p.name}</div>
              <div style={S.prodPrice}>{fmtPrice(p.price)}</div>
              <div style={S.prodMeta}>
                <span style={S.prodStars}>{stars(p.rating)}</span>
                <span style={S.prodSold}>{p.sold.toLocaleString()} sold</span>
              </div>
            </div>
          </div>
        ))}
        {products.length === 0 && !busy && (
          <div style={S.empty}>Press Refresh to load products</div>
        )}
      </div>

      {/* ── bottom nav: method switcher ── */}
      <div style={S.bottomNav}>
        {[
          { key: "pica", label: "Pica (Hamming)", color: "#ef4444" },
          { key: "rifr", label: "RIFR (Canvas)", color: "#06b6d4" },
        ].map((m) => (
          <button key={m.key} style={S.navItem(method === m.key, m.color)}
            onClick={() => setMethod(m.key)} disabled={busy}>
            <span style={S.navDot(m.color)} />
            <span style={S.navLabel}>{m.label}</span>
            {method === m.key && <span style={S.navActive}>● active</span>}
          </button>
        ))}
      </div>

      {/* ── settings drawer ── */}
      {drawerOpen && (
        <div style={S.overlay} onClick={() => setDrawerOpen(false)}>
          <div style={S.drawer} onClick={e => e.stopPropagation()}>
            <div style={S.drawerHead}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Settings</h2>
              <button style={S.closeBtn} onClick={() => setDrawerOpen(false)}>&times;</button>
            </div>

            {/* method */}
            <div style={S.section}>
              <div style={S.secLabel}>Resize Method</div>
              <div style={{ display: "flex", gap: 8 }}>
                {["pica","rifr"].map(m => (
                  <button key={m} style={S.toggle(method === m)} onClick={() => setMethod(m)} disabled={busy}>
                    {m === "pica" ? "Pica (Hamming)" : "RIFR"}
                  </button>
                ))}
              </div>
            </div>

            {/* animation type */}
            <div style={S.section}>
              <div style={S.secLabel}>Animation Type</div>
              {ANIMS.map(a => (
                <label key={a.key} style={S.radio}>
                  <input type="radio" name="anim" checked={animType === a.key}
                    onChange={() => setAnimType(a.key)} disabled={busy} />
                  <span style={{ marginLeft: 8 }}>{a.label}</span>
                </label>
              ))}
            </div>

            {/* animation target */}
            <div style={S.section}>
              <div style={S.secLabel}>Animation Target</div>
              {ANIM_TARGETS.map(t => (
                <label key={t.key} style={S.radio}>
                  <input type="radio" name="target" checked={animTarget === t.key}
                    onChange={() => setAnimTarget(t.key)} disabled={busy} />
                  <span style={{ marginLeft: 8 }}>{t.label}</span>
                </label>
              ))}
            </div>

            {/* count */}
            <div style={S.section}>
              <div style={S.secLabel}>Product Count: <b>{count}</b></div>
              <input type="range" min={STEP} max={MAX_IMG} step={STEP} value={count}
                onChange={e => setCount(+e.target.value)} disabled={busy}
                style={{ width: "100%" }} />
            </div>

            {/* sweep */}
            <div style={S.section}>
              <button style={S.sweepBtn}
                onClick={() => { setDrawerOpen(false); runSweep(); }} disabled={busy}>
                Sweep {STEP} → {MAX_IMG}
              </button>
              {sweepResults.length > 0 && (
                <button style={{ ...S.sweepBtn, background: "#16a34a", marginTop: 8 }}
                  onClick={() => exportCSV(sweepResults, gpu)}>
                  Export Sweep CSV ({sweepResults.length} rows)
                </button>
              )}
              {results.length > 0 && (
                <button style={{ ...S.sweepBtn, background: "#6366f1", marginTop: 8 }}
                  onClick={() => exportCSV(results, gpu)}>
                  Export Results ({results.length} rows)
                </button>
              )}
            </div>

            {/* device info */}
            <div style={{ ...S.section, color: "#888", fontSize: 11, lineHeight: 1.6 }}>
              <b>Device</b><br/>
              GPU: {gpu.renderer}<br/>
              Vendor: {gpu.vendor}<br/>
              Cores: {cores} · RAM: {devRam}<br/>
              Images: {fileNames.length} available
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ MetricChip ═══ */
function MetricChip({ label, value, color }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "#888" }}>{label}</div>
    </div>
  );
}

/* ═══ Styles ═══ */
const S = {
  page: {
    minHeight: "100vh", background: "#f3f4f6",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  topBar: {
    position: "sticky", top: 0, zIndex: 100,
    display: "flex", alignItems: "center", gap: 12,
    padding: "12px 16px", background: "#111", color: "#fff",
  },
  hamburger: {
    background: "none", border: "none", cursor: "pointer", padding: 4,
    display: "flex", flexDirection: "column", gap: 4,
  },
  hamLine: { display: "block", width: 20, height: 2, background: "#fff", borderRadius: 1 },
  logo: { margin: 0, fontSize: 18, fontWeight: 700, flex: 1 },
  deviceBadge: { fontSize: 11, color: "#999", whiteSpace: "nowrap" },
  gpuBar: {
    padding: "4px 16px", background: "#1a1a2e", color: "#7dd3fc",
    fontSize: 10, fontFamily: "monospace", overflow: "hidden",
    textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  actionBar: {
    display: "flex", gap: 8, alignItems: "center",
    padding: "10px 16px", background: "#fff",
    borderBottom: "1px solid #e5e7eb",
  },
  refreshBtn: {
    flex: 1, padding: "10px 0", borderRadius: 8,
    border: "none", background: "#ef4444", color: "#fff",
    fontWeight: 600, fontSize: 14, cursor: "pointer",
  },
  countPill: {
    padding: "8px 14px", borderRadius: 8,
    background: "#f3f4f6", fontSize: 13, fontWeight: 500, color: "#555",
  },
  stopBtn: {
    padding: "8px 14px", borderRadius: 8, border: "none",
    background: "#333", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer",
  },
  phase: {
    padding: "8px 16px", background: "#fef3c7",
    fontSize: 12, fontWeight: 500, color: "#92400e",
  },
  metricsBanner: {
    display: "flex", justifyContent: "space-around",
    padding: "8px 12px", background: "#fff",
    borderBottom: "1px solid #f3f4f6",
  },
  metricsDetail: {
    padding: "6px 16px", background: "#f9fafb", fontSize: 10,
    color: "#666", fontFamily: "monospace", borderBottom: "1px solid #e5e7eb",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  grid: {
    display: "grid", gridTemplateColumns: "repeat(2, 1fr)",
    gap: 10, padding: 12, paddingBottom: 84,
  },
  bottomNav: {
    position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 150,
    display: "flex", background: "#fff",
    borderTop: "1px solid #e5e7eb",
    boxShadow: "0 -2px 10px rgba(0,0,0,0.08)",
  },
  navItem: (on, color) => ({
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", gap: 3, padding: "10px 0 12px",
    border: "none", borderTop: on ? `3px solid ${color}` : "3px solid transparent",
    background: on ? `${color}14` : "#fff",
    color: on ? color : "#9ca3af",
    fontWeight: on ? 700 : 500, fontSize: 13, cursor: "pointer",
    transition: "all 0.15s",
  }),
  navDot: (color) => ({
    width: 14, height: 14, borderRadius: 4, background: color,
  }),
  navLabel: { fontSize: 12, fontWeight: "inherit" },
  navActive: { fontSize: 9, fontWeight: 700, letterSpacing: 0.5 },
  card: {
    background: "#fff", borderRadius: 10, overflow: "hidden",
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
    borderStyle: "solid", borderWidth: 0, borderColor: "transparent",
    boxSizing: "border-box",
  },
  imgWrap: { position: "relative", overflow: "hidden" },
  cardImg: {
    width: "100%", height: 180, objectFit: "cover", display: "block",
    borderStyle: "solid", borderWidth: 0, borderColor: "transparent",
    boxSizing: "border-box",
  },
  cardBody: { padding: "8px 10px 10px" },
  prodName: {
    fontSize: 12, fontWeight: 500, color: "#333",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  prodPrice: { fontSize: 15, fontWeight: 700, color: "#dc2626", marginTop: 2 },
  prodMeta: { display: "flex", justifyContent: "space-between", marginTop: 4 },
  prodStars: { fontSize: 11, color: "#f59e0b" },
  prodSold: { fontSize: 10, color: "#aaa" },
  empty: {
    gridColumn: "1 / -1", padding: 60, textAlign: "center",
    color: "#bbb", fontSize: 14,
  },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
    zIndex: 200, display: "flex",
  },
  drawer: {
    width: 300, maxWidth: "80vw", background: "#fff",
    height: "100%", overflowY: "auto", padding: "0 0 24px",
  },
  drawerHead: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "16px 16px 12px", borderBottom: "1px solid #eee",
  },
  closeBtn: {
    background: "none", border: "none", fontSize: 24,
    cursor: "pointer", color: "#666", padding: "0 4px",
  },
  section: { padding: "14px 16px", borderBottom: "1px solid #f3f4f6" },
  secLabel: { fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 8 },
  toggle: (on) => ({
    flex: 1, padding: 8, borderRadius: 8,
    border: on ? "2px solid #111" : "1px solid #ddd",
    background: on ? "#111" : "#fff",
    color: on ? "#fff" : "#444",
    fontWeight: 600, fontSize: 12, cursor: "pointer",
  }),
  radio: {
    display: "flex", alignItems: "center",
    padding: "6px 0", fontSize: 13, color: "#333", cursor: "pointer",
  },
  sweepBtn: {
    width: "100%", padding: 12, borderRadius: 8,
    border: "none", background: "#2563eb", color: "#fff",
    fontWeight: 600, fontSize: 14, cursor: "pointer",
  },
};
