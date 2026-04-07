import React, { useState, useEffect, useRef } from "react";
import Resizer from "react-image-file-resizer";
import pica from "pica";

function useObjectURLPool() {
  const pool = useRef([]);
  useEffect(() => () => pool.current.forEach((u) => URL.revokeObjectURL(u)), []);
  return (blobOrFile) => {
    const url = URL.createObjectURL(blobOrFile);
    pool.current.push(url);
    return url;
  };
}

function bytesToKB(b) { return (b / 1024).toFixed(1); }

function getTargetSize(w, h, { maxW = 800, maxH = 800, minW = 1, minH = 1 } = {}) {
  let width = w, height = h;
  if (width > maxW)  { height = Math.round((height * maxW)  / width);  width  = maxW;  }
  if (height > maxH) { width  = Math.round((width  * maxH)  / height); height = maxH;  }
  if (width < minW)  { height = Math.round((height * minW)  / width);  width  = minW;  }
  if (height < minH) { width  = Math.round((width  * minH)  / height); height = minH;  }
  return { width, height };
}

function readImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = reject;
    if (typeof src === "string") {
      img.onload = () => resolve(img);
      img.src = src;
    } else {
      const url = URL.createObjectURL(src);
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.src = url;
    }
  });
}

function drawRefCanvas(img, w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  return c;
}

function computeStatsPSNR(aData, bData) {
  let mse = 0, mae = 0;
  const n = aData.length / 4;
  for (let i = 0; i < aData.length; i += 4) {
    const dr = aData[i] - bData[i];
    const dg = aData[i + 1] - bData[i + 1];
    const db = aData[i + 2] - bData[i + 2];
    mae += (Math.abs(dr) + Math.abs(dg) + Math.abs(db)) / 3;
    mse += (dr * dr + dg * dg + db * db) / 3;
  }
  mae /= n; mse /= n;
  const psnr = mse === 0 ? Infinity : (20 * Math.log10(255) - 10 * Math.log10(mse));
  return { psnr, mse, mae };
}

function rifrToBlob({ file, width, height, format = "JPEG", quality = 95 }) {
  return new Promise((resolve) => {
    Resizer.imageFileResizer(file, width, height, format, quality, 0,
      (blob) => resolve(blob), "blob", width, height, true, true);
  });
}

async function hybridResize({ file, width, height, format, picaQuality, filter }) {
  const imgOrig = await readImage(file);
  const intW = Math.min(imgOrig.naturalWidth, width * 2);
  const intH = Math.min(imgOrig.naturalHeight, height * 2);
  const rifrFormat = format === "image/jpeg" ? "JPEG" : format === "image/webp" ? "WEBP" : "PNG";
  const rifrBlob = await rifrToBlob({ file, width: intW, height: intH, format: rifrFormat, quality: 95 });

  const p = pica({ features: ["wasm", "ww", "js"] });
  const intImg = await readImage(rifrBlob);
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = intImg.naturalWidth; srcCanvas.height = intImg.naturalHeight;
  srcCanvas.getContext("2d").drawImage(intImg, 0, 0);
  const dstCanvas = document.createElement("canvas");
  dstCanvas.width = width; dstCanvas.height = height;
  await p.resize(srcCanvas, dstCanvas, { filter });
  const finalBlob = await p.toBlob(dstCanvas, format, picaQuality);
  return { finalBlob, dstCanvas, intW, intH };
}

export default function PureHybrid({ autoFiles = null }) {
  const [pass, setPass]         = useState(null);
  const [items, setItems]       = useState([]);
  const [summary, setSummary]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [opts, setOpts] = useState({ maxW: 800, maxH: 800, picaQuality: 0.9, format: "image/jpeg", filter: "lanczos3" });
  const makeUrl = useObjectURLPool();

  const onPickFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) { setPendingFiles(files); setItems([]); setSummary(null); setPass(null); }
    e.target.value = "";
  };

  useEffect(() => {
    if (autoFiles && autoFiles.length > 0) { setPendingFiles(autoFiles); setItems([]); setSummary(null); setPass(null); }
  }, [autoFiles]);

  // ── PASS 1: SIZE ─────────────────────────────────────────────────────────
  const runSize = async () => {
    setItems([]); setSummary(null); setPass("size"); setLoading(true);
    const out = [];
    for (const file of pendingFiles) {
      try {
        const img = await readImage(file);
        const { width, height } = getTargetSize(img.naturalWidth, img.naturalHeight, { maxW: opts.maxW, maxH: opts.maxH });
        const { finalBlob } = await hybridResize({ file, width, height, format: opts.format, picaQuality: opts.picaQuality, filter: opts.filter });
        out.push({
          name: file.name,
          origBytes: file.size, outBytes: finalBlob.size,
          deltaKB: (file.size - finalBlob.size) / 1024,
          ratio: ((1 - finalBlob.size / file.size) * 100).toFixed(1),
          beforeUrl: makeUrl(file), afterUrl: makeUrl(finalBlob),
          dimsText: `${width}×${height}`,
        });
        setItems([...out]);
      } catch (e) { console.warn("Skip:", file.name, e); }
    }
    const n = out.length || 1;
    setSummary({ type: "size", count: out.length, totalDeltaKB: out.reduce((s, r) => s + r.deltaKB, 0).toFixed(2), avgRatio: (out.reduce((s, r) => s + Number(r.ratio), 0) / n).toFixed(1) });
    setLoading(false);
  };

  // ── PASS 2: TIME ─────────────────────────────────────────────────────────
  const runTime = async () => {
    setItems([]); setSummary(null); setPass("time"); setLoading(true);
    const out = [];
    for (const file of pendingFiles) {
      try {
        const img = await readImage(file);
        const { width, height } = getTargetSize(img.naturalWidth, img.naturalHeight, { maxW: opts.maxW, maxH: opts.maxH });
        const t0 = performance.now();
        await hybridResize({ file, width, height, format: opts.format, picaQuality: opts.picaQuality, filter: opts.filter });
        const timeMs = performance.now() - t0;
        out.push({ name: file.name, timeMs });
        setItems([...out]);
      } catch (e) { console.warn("Skip:", file.name, e); }
    }
    const n = out.length || 1;
    const total = out.reduce((s, r) => s + r.timeMs, 0);
    setSummary({ type: "time", count: out.length, totalMs: total.toFixed(2), avgMs: (total / n).toFixed(2) });
    setLoading(false);
  };

  // ── PASS 3: PSNR ─────────────────────────────────────────────────────────
  const runPSNR = async () => {
    setItems([]); setSummary(null); setPass("psnr"); setLoading(true);
    const out = [];
    for (const file of pendingFiles) {
      try {
        const img = await readImage(file);
        const { width, height } = getTargetSize(img.naturalWidth, img.naturalHeight, { maxW: opts.maxW, maxH: opts.maxH });
        const refData = drawRefCanvas(img, width, height).getContext("2d").getImageData(0, 0, width, height).data;
        const { dstCanvas } = await hybridResize({ file, width, height, format: opts.format, picaQuality: opts.picaQuality, filter: opts.filter });
        const { psnr, mse, mae } = computeStatsPSNR(dstCanvas.getContext("2d").getImageData(0, 0, width, height).data, refData);
        out.push({ name: file.name, psnr, mse, mae });
        setItems([...out]);
      } catch (e) { console.warn("Skip:", file.name, e); }
    }
    const n = out.length || 1;
    setSummary({ type: "psnr", count: out.length, avgPSNR: (out.reduce((s, r) => s + (isFinite(r.psnr) ? r.psnr : 100), 0) / n).toFixed(2), avgMSE: (out.reduce((s, r) => s + r.mse, 0) / n).toExponential(3), avgMAE: (out.reduce((s, r) => s + r.mae, 0) / n).toFixed(2) });
    setLoading(false);
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const wrap  = { padding: "16px", display: "grid", gap: "12px", maxWidth: "720px", margin: "0 auto", background: "#fafafa" };
  const card  = { border: "1px solid #e9e9e9", borderRadius: "16px", background: "#fff", padding: "14px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "grid", gap: "10px" };
  const row   = { display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "flex-end" };
  const lCol  = { display: "grid", gap: "4px", fontSize: "12px" };
  const inp   = { border: "1px solid #ddd", borderRadius: "8px", padding: "6px 8px", width: "100px", fontSize: "13px", outline: "none" };
  const sel   = { ...inp, width: "130px" };
  const small = { fontSize: "11px", color: "#888" };
  const badge = { display: "inline-block", padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, background: "#111", color: "#fff", marginLeft: 8 };
  const passBtn = (active, color = "#111") => ({
    flex: 1, padding: "10px 0", borderRadius: "10px", fontSize: "13px", fontWeight: 700,
    border: `2px solid ${active ? color : "#ddd"}`,
    background: active ? color : "#fff",
    color: active ? "#fff" : "#888",
    cursor: loading ? "not-allowed" : "pointer",
    opacity: pendingFiles.length === 0 ? 0.4 : 1,
  });

  return (
    <section style={wrap}>
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
        Hybrid <span style={badge}>RIFR → Pica</span>
      </h2>

      {/* Settings */}
      <div style={card}>
        <div style={row}>
          <label style={lCol}>Max W<input type="number" style={inp} value={opts.maxW} min={1} onChange={(e) => setOpts(o => ({ ...o, maxW: Number(e.target.value || 0) }))} /></label>
          <label style={lCol}>Max H<input type="number" style={inp} value={opts.maxH} min={1} onChange={(e) => setOpts(o => ({ ...o, maxH: Number(e.target.value || 0) }))} /></label>
          <label style={lCol}>Quality
            <input type="number" step="0.05" style={inp} value={opts.picaQuality} min={0} max={1} onChange={(e) => setOpts(o => ({ ...o, picaQuality: Math.max(0, Math.min(1, Number(e.target.value || 0))) }))} />
          </label>
          <label style={lCol}>Format
            <select style={sel} value={opts.format} onChange={(e) => setOpts(o => ({ ...o, format: e.target.value }))}>
              <option value="image/jpeg">JPEG</option>
              <option value="image/webp">WEBP</option>
              <option value="image/png">PNG</option>
            </select>
          </label>
          <label style={lCol}>Filter
            <select style={sel} value={opts.filter} onChange={(e) => setOpts(o => ({ ...o, filter: e.target.value }))}>
              <option value="lanczos3">lanczos3</option>
              <option value="lanczos2">lanczos2</option>
              <option value="hamming">hamming</option>
              <option value="mks2013">mks2013</option>
              <option value="box">box</option>
              <option value="hermite">hermite</option>
            </select>
          </label>
        </div>
        <label style={lCol}>
          Pilih gambar
          <input type="file" accept="image/*" multiple onChange={onPickFiles} />
        </label>
        {pendingFiles.length > 0 && <span style={small}>{pendingFiles.length} file siap · Pipeline: RIFR (2×) → Pica {opts.filter}</span>}
      </div>

      {/* 3 Pass Buttons */}
      <div style={{ display: "flex", gap: 8 }}>
        <button style={passBtn(pass === "size", "#2563eb")} disabled={pendingFiles.length === 0 || loading} onClick={runSize}>📦 Size</button>
        <button style={passBtn(pass === "time", "#16a34a")} disabled={pendingFiles.length === 0 || loading} onClick={runTime}>⏱ Time</button>
        <button style={passBtn(pass === "psnr", "#9333ea")} disabled={pendingFiles.length === 0 || loading} onClick={runPSNR}>📊 PSNR</button>
      </div>

      {loading && <div style={{ fontSize: 12, color: "#888", textAlign: "center" }}>⏳ Memproses {items.length}/{pendingFiles.length}...</div>}

      {/* Summary */}
      {summary && !loading && (
        <div style={{ ...card, background: summary.type === "size" ? "#eff6ff" : summary.type === "time" ? "#f0fdf4" : "#faf5ff", border: `1px solid ${summary.type === "size" ? "#bfdbfe" : summary.type === "time" ? "#bbf7d0" : "#e9d5ff"}` }}>
          <strong style={{ fontSize: 13 }}>
            {summary.type === "size" && `📦 ${summary.count} file · Total hemat: ${summary.totalDeltaKB} KB · Rata-rata: ${summary.avgRatio}%`}
            {summary.type === "time" && `⏱ ${summary.count} file · Total: ${summary.totalMs} ms · Rata-rata: ${summary.avgMs} ms`}
            {summary.type === "psnr" && `📊 ${summary.count} file · Avg PSNR: ${summary.avgPSNR} dB · Avg MSE: ${summary.avgMSE} · Avg MAE: ${summary.avgMAE}`}
          </strong>
        </div>
      )}

      {/* Items */}
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((it, i) => (
          <div key={i} style={{ ...card, padding: "10px 14px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={it.name}>{it.name}</div>

            {pass === "size" && (
              <div style={{ fontSize: 12, display: "grid", gap: 4 }}>
                <div style={{ display: "flex", gap: 12 }}>
                  <span>📁 {bytesToKB(it.origBytes)} KB</span>
                  <span>→</span>
                  <span>🗜 {bytesToKB(it.outBytes)} KB</span>
                  <span style={{ marginLeft: "auto", color: "#2563eb", fontWeight: 700 }}>-{it.ratio}%</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <img src={it.beforeUrl} alt="before" style={{ width: "50%", height: 100, objectFit: "contain", background: "#f5f5f5", borderRadius: 8 }} />
                  <img src={it.afterUrl}  alt="after"  style={{ width: "50%", height: 100, objectFit: "contain", background: "#f5f5f5", borderRadius: 8 }} />
                </div>
                <div style={small}>{it.dimsText} · hemat {it.deltaKB.toFixed(1)} KB</div>
              </div>
            )}

            {pass === "time" && (
              <div style={{ fontSize: 20, fontWeight: 700, color: "#16a34a" }}>⏱ {it.timeMs.toFixed(2)} ms</div>
            )}

            {pass === "psnr" && (
              <div style={{ display: "grid", gap: 2 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#9333ea" }}>
                  {isFinite(it.psnr) ? `${it.psnr.toFixed(2)} dB` : "∞ dB"}
                </div>
                <div style={small}>MSE: {it.mse.toExponential(3)} · MAE: {it.mae.toFixed(2)}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
