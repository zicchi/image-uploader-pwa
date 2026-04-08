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

/* ═══ Animations ═══ */
const ANIMS = [
  { key: "scale-fade", label: "Scale + Fade" },
  { key: "rotate-fade", label: "Rotate + Fade" },
  { key: "slide-fade", label: "Slide + Fade" },
  { key: "scale-rotate", label: "Scale + Rotate" },
  { key: "slide-scale", label: "Slide + Scale" },
];
const ANIM_MS = 1500;
const COOLDOWN_MS = 2000;
const MAX_IMG = 200;
const STEP = 5;

const KF = `
@keyframes b-scale-fade {
  0%   { transform:scale(1);    opacity:1;   filter:blur(0px) brightness(1) saturate(1);         box-shadow:0 0 0 rgba(0,0,0,0); }
  14%  { transform:scale(1.08); opacity:.8;  filter:blur(2px) brightness(1.15) saturate(1.3);    box-shadow:0 4px 16px rgba(0,0,0,.15); }
  28%  { transform:scale(1.18); opacity:.5;  filter:blur(5px) brightness(1.3) saturate(1.6);     box-shadow:0 8px 32px rgba(0,0,0,.3); }
  42%  { transform:scale(1.3);  opacity:.2;  filter:blur(8px) brightness(1.5) saturate(2);       box-shadow:0 12px 48px rgba(0,0,0,.45); }
  57%  { transform:scale(1.35); opacity:.1;  filter:blur(10px) brightness(1.6) saturate(2.5);    box-shadow:0 16px 60px rgba(0,0,0,.5); }
  71%  { transform:scale(1.18); opacity:.4;  filter:blur(5px) brightness(1.3) saturate(1.6);     box-shadow:0 8px 32px rgba(0,0,0,.3); }
  85%  { transform:scale(1.08); opacity:.7;  filter:blur(2px) brightness(1.1) saturate(1.2);     box-shadow:0 4px 16px rgba(0,0,0,.1); }
  100% { transform:scale(1);    opacity:1;   filter:blur(0px) brightness(1) saturate(1);         box-shadow:0 0 0 rgba(0,0,0,0); }
}
@keyframes b-rotate-fade {
  0%   { transform:rotate(0deg);   opacity:1;   filter:blur(0px) saturate(1) contrast(1);       box-shadow:0 0 0 rgba(0,0,0,0); }
  14%  { transform:rotate(50deg);  opacity:.8;  filter:blur(2px) saturate(1.5) contrast(1.2);   box-shadow:4px 4px 20px rgba(0,0,0,.2); }
  28%  { transform:rotate(100deg); opacity:.5;  filter:blur(5px) saturate(2.2) contrast(1.4);   box-shadow:8px 8px 36px rgba(0,0,0,.35); }
  42%  { transform:rotate(160deg); opacity:.2;  filter:blur(8px) saturate(3) contrast(1.6);     box-shadow:10px 10px 48px rgba(0,0,0,.5); }
  57%  { transform:rotate(220deg); opacity:.15; filter:blur(10px) saturate(3.5) contrast(1.8);  box-shadow:8px 8px 36px rgba(0,0,0,.45); }
  71%  { transform:rotate(280deg); opacity:.4;  filter:blur(5px) saturate(2) contrast(1.3);     box-shadow:4px 4px 20px rgba(0,0,0,.25); }
  85%  { transform:rotate(330deg); opacity:.7;  filter:blur(2px) saturate(1.3) contrast(1.1);   box-shadow:2px 2px 10px rgba(0,0,0,.1); }
  100% { transform:rotate(360deg); opacity:1;   filter:blur(0px) saturate(1) contrast(1);       box-shadow:0 0 0 rgba(0,0,0,0); }
}
@keyframes b-slide-fade {
  0%   { transform:translateX(0);  opacity:1;   filter:blur(0px) contrast(1) brightness(1);     box-shadow:0 0 0 rgba(0,0,0,0); }
  14%  { transform:translateX(8%); opacity:.8;  filter:blur(2px) contrast(1.2) brightness(1.15);box-shadow:-4px 0 20px rgba(0,0,0,.15); }
  28%  { transform:translateX(18%);opacity:.5;  filter:blur(5px) contrast(1.5) brightness(1.3); box-shadow:-8px 0 36px rgba(0,0,0,.3); }
  42%  { transform:translateX(28%);opacity:.2;  filter:blur(8px) contrast(1.8) brightness(1.5); box-shadow:-12px 0 48px rgba(0,0,0,.45); }
  57%  { transform:translateX(22%);opacity:.15; filter:blur(10px) contrast(2) brightness(1.6);  box-shadow:-10px 0 40px rgba(0,0,0,.4); }
  71%  { transform:translateX(14%);opacity:.4;  filter:blur(5px) contrast(1.4) brightness(1.2); box-shadow:-6px 0 24px rgba(0,0,0,.2); }
  85%  { transform:translateX(6%); opacity:.7;  filter:blur(2px) contrast(1.15) brightness(1.08);box-shadow:-3px 0 12px rgba(0,0,0,.1); }
  100% { transform:translateX(0);  opacity:1;   filter:blur(0px) contrast(1) brightness(1);     box-shadow:0 0 0 rgba(0,0,0,0); }
}
@keyframes b-scale-rotate {
  0%   { transform:scale(1) rotate(0deg);       filter:blur(0px) brightness(1) contrast(1) saturate(1);       box-shadow:0 0 0 rgba(0,0,0,0); }
  14%  { transform:scale(1.08) rotate(50deg);   filter:blur(2px) brightness(1.2) contrast(1.15) saturate(1.3);box-shadow:4px 4px 20px rgba(0,0,0,.2); }
  28%  { transform:scale(1.18) rotate(100deg);  filter:blur(5px) brightness(1.4) contrast(1.3) saturate(1.8); box-shadow:8px 8px 36px rgba(0,0,0,.35); }
  42%  { transform:scale(1.3) rotate(160deg);   filter:blur(8px) brightness(1.6) contrast(1.5) saturate(2.2); box-shadow:12px 12px 48px rgba(0,0,0,.5); }
  57%  { transform:scale(1.35) rotate(220deg);  filter:blur(10px) brightness(1.7) contrast(1.6) saturate(2.8);box-shadow:10px 10px 40px rgba(0,0,0,.45); }
  71%  { transform:scale(1.18) rotate(280deg);  filter:blur(5px) brightness(1.3) contrast(1.25) saturate(1.6);box-shadow:6px 6px 24px rgba(0,0,0,.25); }
  85%  { transform:scale(1.06) rotate(330deg);  filter:blur(2px) brightness(1.1) contrast(1.1) saturate(1.2); box-shadow:2px 2px 10px rgba(0,0,0,.1); }
  100% { transform:scale(1) rotate(360deg);     filter:blur(0px) brightness(1) contrast(1) saturate(1);       box-shadow:0 0 0 rgba(0,0,0,0); }
}
@keyframes b-slide-scale {
  0%   { transform:translateX(0) scale(1);      filter:blur(0px) saturate(1) brightness(1) contrast(1);       box-shadow:0 0 0 rgba(0,0,0,0); }
  14%  { transform:translateX(5%) scale(1.08);  filter:blur(2px) saturate(1.5) brightness(1.15) contrast(1.15);box-shadow:-4px 4px 20px rgba(0,0,0,.2); }
  28%  { transform:translateX(12%) scale(1.18); filter:blur(5px) saturate(2.2) brightness(1.3) contrast(1.3); box-shadow:-8px 8px 36px rgba(0,0,0,.35); }
  42%  { transform:translateX(20%) scale(1.3);  filter:blur(8px) saturate(3) brightness(1.5) contrast(1.5);   box-shadow:-12px 12px 48px rgba(0,0,0,.5); }
  57%  { transform:translateX(24%) scale(1.35); filter:blur(10px) saturate(3.5) brightness(1.6) contrast(1.6);box-shadow:-14px 14px 56px rgba(0,0,0,.5); }
  71%  { transform:translateX(14%) scale(1.18); filter:blur(5px) saturate(2) brightness(1.25) contrast(1.25); box-shadow:-6px 6px 24px rgba(0,0,0,.25); }
  85%  { transform:translateX(5%) scale(1.06);  filter:blur(2px) saturate(1.3) brightness(1.08) contrast(1.08);box-shadow:-2px 2px 10px rgba(0,0,0,.1); }
  100% { transform:translateX(0) scale(1);      filter:blur(0px) saturate(1) brightness(1) contrast(1);       box-shadow:0 0 0 rgba(0,0,0,0); }
}
@keyframes bd-pulse {
  0%   { backdrop-filter:blur(0px) brightness(1); }
  50%  { backdrop-filter:blur(12px) brightness(1.3); }
  100% { backdrop-filter:blur(0px) brightness(1); }
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
      [r.n,r.method,r.anim,r.fps,r.frames,r.avgMs,r.dropped,r.jank,
       r.memAfter??"",r.memDelta??"",r.longTasks,r.resizeMs].join(",")
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `shopbench-${Date.now()}.csv`;
  a.click();
}

/* ═══ Component ═══ */
export default function AnimationGallery() {
  const pica = useMemo(() => picaLib({ features: ["wasm", "ww", "js"] }), []);

  /* files */
  const [allFiles, setAllFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(true);

  /* settings */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [animType, setAnimType] = useState("scale-fade");
  const [method, setMethod] = useState("pica");
  const [count, setCount] = useState(10);

  /* bench state */
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState("");
  const [products, setProducts] = useState([]); // { name, price, rating, sold, url }
  const [activeAnim, setActiveAnim] = useState(null);
  const [animKey, setAnimKey] = useState(0);
  const [lastMetrics, setLastMetrics] = useState(null);
  const [results, setResults] = useState([]);
  const [sweepResults, setSweepResults] = useState([]);
  const [sweeping, setSweeping] = useState(false);

  const cancelRef = useRef(false);
  const rafRef = useRef(null);
  const ftRef = useRef([]);
  const ltRef = useRef([]);
  const obsRef = useRef(null);

  /* load 200 files */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/assets/200/manifest.json");
        const names = await r.json();
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
  }, []);

  /* pica resize (Hamming) */
  const picaResize = useCallback(
    async (file, maxW, maxH) => {
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
    },
    [pica]
  );

  /* measurement */
  function startMeasure() {
    ftRef.current = []; ltRef.current = [];
    let last = performance.now();
    try {
      obsRef.current = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) ltRef.current.push(e.duration);
      });
      obsRef.current.observe({ entryTypes: ["longtask"] });
    } catch (e) {}
    const tick = (now) => {
      ftRef.current.push(now - last); last = now;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }
  function stopMeasure() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (obsRef.current) { obsRef.current.disconnect(); obsRef.current = null; }
    const ft = ftRef.current;
    if (!ft.length) return { fps: 0, frames: 0, avgMs: 0, dropped: 0, jank: 0, longTasks: 0 };
    const avg = ft.reduce((a, b) => a + b, 0) / ft.length;
    const dropped = ft.filter(t => t > 33.33).length;
    return {
      fps: Math.round(1000 / avg), frames: ft.length,
      avgMs: +avg.toFixed(2), dropped,
      jank: +((dropped / ft.length) * 100).toFixed(1),
      longTasks: ltRef.current.length,
    };
  }

  /* single refresh — resize + animate selected type */
  const runRefresh = useCallback(async () => {
    const files = allFiles.slice(0, count);
    if (!files.length) return;
    setRunning(true); setProducts([]); setLastMetrics(null);
    setPhase(`Loading ${count} products...`);

    const t0 = performance.now();
    const items = [];
    for (let i = 0; i < files.length; i++) {
      if (cancelRef.current) break;
      setPhase(`Resizing ${i + 1}/${count}`);
      const blob = method === "pica"
        ? await picaResize(files[i], 800, 600)
        : await rifrToBlob(files[i], 800, 600);
      const url = blob instanceof Blob ? URL.createObjectURL(blob) : blob;
      items.push({ ...genProduct(i), url });
    }
    const resizeMs = Math.round(performance.now() - t0);
    setProducts(items);

    // animate
    setPhase(`Animating ${ANIMS.find(a => a.key === animType).label}...`);
    setActiveAnim(animType);
    setAnimKey(k => k + 1);
    const mb = getMemMB();
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    startMeasure();
    await new Promise(r => setTimeout(r, ANIM_MS + 100));
    const metrics = stopMeasure();
    const ma = getMemMB();
    setActiveAnim(null);

    const row = {
      n: count, method, anim: animType, ...metrics,
      memBefore: mb, memAfter: ma,
      memDelta: mb != null && ma != null ? +(ma - mb).toFixed(2) : null,
      resizeMs,
    };
    setLastMetrics(row);
    setResults(prev => [...prev, row]);
    setPhase("");
    setRunning(false);
  }, [allFiles, count, method, animType, picaResize]);

  /* sweep 5→200 × all 5 anims */
  const runSweep = useCallback(async () => {
    cancelRef.current = false;
    setSweeping(true); setSweepResults([]);
    for (let n = STEP; n <= MAX_IMG; n += STEP) {
      if (cancelRef.current) break;
      const files = allFiles.slice(0, n);
      if (!files.length) break;
      setProducts([]); setPhase(`Sweep: resizing ${n} images...`);
      const t0 = performance.now();
      const items = [];
      for (let i = 0; i < files.length; i++) {
        if (cancelRef.current) break;
        setPhase(`Sweep ${n}: resize ${i + 1}/${n}`);
        const blob = method === "pica"
          ? await picaResize(files[i], 800, 600)
          : await rifrToBlob(files[i], 800, 600);
        const url = blob instanceof Blob ? URL.createObjectURL(blob) : blob;
        items.push({ ...genProduct(i), url });
      }
      const resizeMs = Math.round(performance.now() - t0);
      setProducts(items);

      for (let ai = 0; ai < ANIMS.length; ai++) {
        if (cancelRef.current) break;
        const { key, label } = ANIMS[ai];
        if (ai > 0) {
          setPhase(`Cooldown...`); setActiveAnim(null);
          await new Promise(r => setTimeout(r, COOLDOWN_MS));
        }
        if (cancelRef.current) break;
        setPhase(`Sweep ${n}: ${label}`);
        setActiveAnim(key); setAnimKey(k => k + 1);
        const mb = getMemMB();
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        startMeasure();
        await new Promise(r => setTimeout(r, ANIM_MS + 100));
        const metrics = stopMeasure();
        const ma = getMemMB();
        setSweepResults(prev => [...prev, {
          n, method, anim: key, ...metrics,
          memBefore: mb, memAfter: ma,
          memDelta: mb != null && ma != null ? +(ma - mb).toFixed(2) : null,
          resizeMs,
        }]);
      }
      setActiveAnim(null);
      items.forEach(p => { try { URL.revokeObjectURL(p.url); } catch(e){} });
    }
    setPhase("Sweep done!");
    setSweeping(false);
  }, [allFiles, method, picaResize]);

  const handleStop = () => { cancelRef.current = true; };
  const busy = running || sweeping;
  const cores = navigator.hardwareConcurrency || "?";
  const devRam = navigator.deviceMemory ? `${navigator.deviceMemory} GB` : "N/A";

  if (loadingFiles)
    return <div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>Loading {MAX_IMG} images...</div>;

  return (
    <div style={S.page}>
      <style>{KF}</style>

      {/* ── top bar ── */}
      <div style={S.topBar}>
        <button style={S.hamburger} onClick={() => setDrawerOpen(true)}>
          <span style={S.hamLine}/><span style={S.hamLine}/><span style={S.hamLine}/>
        </button>
        <h1 style={S.logo}>ShopBench</h1>
        <div style={S.deviceBadge}>{cores}c · {devRam}</div>
      </div>

      {/* ── action bar ── */}
      <div style={S.actionBar}>
        <button style={S.refreshBtn} onClick={() => { cancelRef.current = false; runRefresh(); }} disabled={busy}>
          {running ? "Loading..." : "Refresh"}
        </button>
        <div style={S.countPill}>{count} items</div>
        {busy && <button style={S.stopBtn} onClick={handleStop}>Stop</button>}
      </div>

      {/* ── phase ── */}
      {phase && <div style={S.phase}>{phase}</div>}

      {/* ── metrics banner ── */}
      {lastMetrics && !phase && (
        <div style={S.metricsBanner}>
          <MetricChip label="FPS" value={lastMetrics.fps}
            color={lastMetrics.fps >= 55 ? "#16a34a" : lastMetrics.fps >= 30 ? "#ca8a04" : "#dc2626"} />
          <MetricChip label="Jank" value={lastMetrics.jank + "%"}
            color={lastMetrics.jank <= 1 ? "#16a34a" : lastMetrics.jank <= 5 ? "#ca8a04" : "#dc2626"} />
          <MetricChip label="RAM" value={(lastMetrics.memAfter ?? "N/A") + " MB"} color="#6366f1" />
          <MetricChip label="Resize" value={lastMetrics.resizeMs + "ms"} color="#888" />
        </div>
      )}

      {/* ── product grid ── */}
      <div style={S.grid}>
        {products.map((p, i) => (
          <div key={`${i}-${animKey}`} style={S.card}>
            <div style={S.imgWrap}>
              <img src={p.url} alt="" style={{
                ...S.cardImg,
                animation: activeAnim ? ANIM_CSS[activeAnim] : "none",
              }} />
              {activeAnim && <div style={{
                position: "absolute", inset: 0,
                animation: `bd-pulse ${ANIM_MS}ms ease-in-out`,
                pointerEvents: "none",
              }} />}
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

            {/* animation */}
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

            {/* count */}
            <div style={S.section}>
              <div style={S.secLabel}>Product Count: <b>{count}</b></div>
              <input type="range" min={STEP} max={MAX_IMG} step={STEP} value={count}
                onChange={e => setCount(+e.target.value)} disabled={busy}
                style={{ width: "100%" }} />
            </div>

            {/* sweep */}
            <div style={S.section}>
              <button style={S.sweepBtn} onClick={() => { setDrawerOpen(false); runSweep(); }} disabled={busy}>
                Sweep 5 → 200
              </button>
              {sweepResults.length > 0 && (
                <button style={{ ...S.sweepBtn, background: "#16a34a", marginTop: 8 }}
                  onClick={() => exportCSV(sweepResults)}>
                  Export CSV ({sweepResults.length} rows)
                </button>
              )}
              {results.length > 0 && !sweepResults.length && (
                <button style={{ ...S.sweepBtn, background: "#6366f1", marginTop: 8 }}
                  onClick={() => exportCSV(results)}>
                  Export Results ({results.length} rows)
                </button>
              )}
            </div>

            {/* device info */}
            <div style={{ ...S.section, color: "#aaa", fontSize: 11 }}>
              {cores} cores · RAM {devRam} · {allFiles.length} images
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
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
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
  /* top bar */
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
  /* action bar */
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
  /* phase */
  phase: {
    padding: "8px 16px", background: "#fef3c7",
    fontSize: 12, fontWeight: 500, color: "#92400e",
  },
  /* metrics banner */
  metricsBanner: {
    display: "flex", justifyContent: "space-around",
    padding: "10px 16px", background: "#fff",
    borderBottom: "1px solid #e5e7eb",
  },
  /* grid */
  grid: {
    display: "grid", gridTemplateColumns: "repeat(2, 1fr)",
    gap: 10, padding: 12,
  },
  card: {
    background: "#fff", borderRadius: 10, overflow: "hidden",
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  },
  imgWrap: { position: "relative", overflow: "hidden" },
  cardImg: {
    width: "100%", aspectRatio: "1", objectFit: "cover", display: "block",
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
  /* drawer */
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
