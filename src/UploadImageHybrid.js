/**
 * UploadImageHybrid.js
 * Benchmark: Hybrid (RIFR pre-shrink → Pica Lanczos/Hamming final resize)
 * Menampilkan metrik PSNR / MSE / MAE per file + summary.
 */
import React, { useState, useMemo } from "react";
import Resizer from "react-image-file-resizer";
import picaLib from "pica";

const MAX_W = 800;
const MAX_H = 800;

// ─── Ukuran target ────────────────────────────────────────────────────────────
function getTargetSize(w, h, maxW = MAX_W, maxH = MAX_H) {
  if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
  if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
  if (w < 200)  { h = Math.round(h * 200  / w); w = 200;  }
  if (h < 200)  { w = Math.round(w * 200  / h); h = 200;  }
  return { w, h };
}

// ─── Reference canvas (acuan PSNR) ───────────────────────────────────────────
function drawRefCanvas(img, w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  return c;
}

// ─── Metrik PSNR / MSE / MAE ─────────────────────────────────────────────────
function computeStatsPSNR(aData, bData) {
  let mse = 0, mae = 0;
  const n = aData.length / 4;
  for (let i = 0; i < aData.length; i += 4) {
    const dr = aData[i]   - bData[i];
    const dg = aData[i+1] - bData[i+1];
    const db = aData[i+2] - bData[i+2];
    mae += (Math.abs(dr) + Math.abs(dg) + Math.abs(db)) / 3;
    mse += (dr*dr + dg*dg + db*db) / 3;
  }
  mae /= n; mse /= n;
  const psnr = mse === 0 ? Infinity : (20 * Math.log10(255) - 10 * Math.log10(mse));
  return { psnr, mse, mae };
}

// ─── RIFR → Blob ──────────────────────────────────────────────────────────────
function rifrToBlob(file, width, height, quality = 95) {
  return new Promise((resolve) => {
    Resizer.imageFileResizer(
      file, width, height, "JPEG", quality, 0,
      (blob) => resolve(blob),
      "blob", width, height, true, true
    );
  });
}

// ─── Pica: Canvas sumber → Blob ───────────────────────────────────────────────
async function picaCanvasToBlob(pica, srcCanvas, w, h, filter = "lanczos3") {
  const dst = document.createElement("canvas");
  dst.width = w; dst.height = h;
  await pica.resize(srcCanvas, dst, { filter });
  return pica.toBlob(dst, "image/jpeg", 0.9);
}

// ─── Hybrid core ─────────────────────────────────────────────────────────────
async function runHybrid(pica, file, w, h, filter = "lanczos3") {
  // Dimensi asli
  const imgOrig = document.createElement("img");
  imgOrig.src = URL.createObjectURL(file);
  await new Promise((r) => (imgOrig.onload = r));
  const origW = imgOrig.naturalWidth;
  const origH = imgOrig.naturalHeight;
  URL.revokeObjectURL(imgOrig.src);

  // Intermediate = min(asli, 2× target)
  const intW = Math.min(origW, w * 2);
  const intH = Math.min(origH, h * 2);

  // Tahap 1: RIFR pre-shrink (bilinear + EXIF handling)
  const rifrBlob = await rifrToBlob(file, intW, intH, 95);

  // Tahap 2: Pica Lanczos/Hamming final resize
  const rifrImg = document.createElement("img");
  rifrImg.src = URL.createObjectURL(rifrBlob);
  await new Promise((r) => (rifrImg.onload = r));

  const srcCanvas = document.createElement("canvas");
  srcCanvas.width  = rifrImg.naturalWidth;
  srcCanvas.height = rifrImg.naturalHeight;
  srcCanvas.getContext("2d").drawImage(rifrImg, 0, 0);
  URL.revokeObjectURL(rifrImg.src);

  const finalBlob = await picaCanvasToBlob(pica, srcCanvas, w, h, filter);

  // Pixel data hasil hybrid untuk PSNR
  const finalImg = document.createElement("img");
  finalImg.src = URL.createObjectURL(finalBlob);
  await new Promise((r) => (finalImg.onload = r));
  const outCanvas = document.createElement("canvas");
  outCanvas.width = w; outCanvas.height = h;
  outCanvas.getContext("2d").drawImage(finalImg, 0, 0, w, h);
  URL.revokeObjectURL(finalImg.src);

  return { finalBlob, outCanvas, rifrBlob, intW, intH };
}

// ─── Komponen ─────────────────────────────────────────────────────────────────
export default function UploadImageHybrid() {
  const [filter, setFilter] = useState("lanczos3");
  const [rows, setRows]     = useState([]);
  const [summary, setSummary] = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const pica = useMemo(() => picaLib({ features: ["wasm", "ww", "js"] }), []);

  const processOne = async (file) => {
    // Dimensi target
    const imgRef = document.createElement("img");
    imgRef.src = URL.createObjectURL(file);
    await new Promise((r) => (imgRef.onload = r));
    const { w, h } = getTargetSize(imgRef.naturalWidth, imgRef.naturalHeight);

    // Reference canvas untuk PSNR
    const refCanvas = drawRefCanvas(imgRef, w, h);
    const refData   = refCanvas.getContext("2d").getImageData(0, 0, w, h).data;
    URL.revokeObjectURL(imgRef.src);

    const t0 = performance.now();

    const { finalBlob, outCanvas, rifrBlob, intW, intH } = await runHybrid(pica, file, w, h, filter);

    const outData = outCanvas.getContext("2d").getImageData(0, 0, w, h).data;
    const { psnr, mse, mae } = computeStatsPSNR(outData, refData);

    const t1 = performance.now();

    return {
      method: `hybrid-${filter}`,
      filename: file.name,
      w, h,
      intW, intH,
      origBytes: file.size,
      rifrBytes: rifrBlob.size,
      outBytes:  finalBlob.size,
      deltaKB:   (file.size - finalBlob.size) / 1024,
      timeMs:    t1 - t0,
      psnr, mse, mae,
    };
  };

  const runCalculate = async (files) => {
    if (!files.length) return;
    setLoading(true);
    const results = [];
    for (const f of files) {
      /* eslint-disable no-await-in-loop */
      results.push(await processOne(f));
    }
    setRows(results);

    const sum = results.reduce((acc, r) => {
      acc.deltaKB += r.deltaKB;
      acc.timeMs  += r.timeMs;
      acc.psnr    += isFinite(r.psnr) ? r.psnr : 100;
      acc.mse     += r.mse;
      acc.mae     += r.mae;
      return acc;
    }, { deltaKB: 0, timeMs: 0, psnr: 0, mse: 0, mae: 0 });

    const n = results.length || 1;
    setSummary({
      count:        results.length,
      totalTimeMs:  sum.timeMs.toFixed(2),
      totalDeltaKB: sum.deltaKB.toFixed(2),
      avgPSNR:      (sum.psnr / n).toFixed(2),
      avgMSE:       (sum.mse / n).toExponential(3),
      avgMAE:       (sum.mae / n).toFixed(2),
    });
    setLoading(false);
  };

  const onChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) setPendingFiles(files);
  };

  const th = { padding: "6px 10px", background: "#f0f0f0", fontSize: "12px", whiteSpace: "nowrap" };
  const td = { padding: "6px 10px", fontSize: "12px", borderBottom: "1px solid #eee" };

  return (
    <div style={{ display: "grid", gap: 12, padding: 16 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
        Benchmark — Hybrid (RIFR → Pica)
      </h2>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 13 }}>
          Pica filter:&nbsp;
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            style={{ padding: "6px 8px", borderRadius: 6, fontSize: 13 }}>
            <option value="lanczos3">lanczos3</option>
            <option value="lanczos2">lanczos2</option>
            <option value="hamming">hamming</option>
            <option value="mks2013">mks2013</option>
          </select>
        </label>
        <input type="file" multiple accept="image/*" onChange={onChange} />
        <button
          onClick={() => runCalculate(pendingFiles)}
          disabled={pendingFiles.length === 0 || loading}
          style={{
            padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700,
            border: "none", background: "#111", color: "#fff", cursor: "pointer",
            opacity: pendingFiles.length === 0 || loading ? 0.4 : 1,
          }}
        >
          {rows.length > 0 ? "🔄 Re-calculate" : "▶ Hitung"}
        </button>
        {pendingFiles.length > 0 && !loading && (
          <span style={{ fontSize: 12, color: "#888" }}>{pendingFiles.length} file siap</span>
        )}
        {loading && <span style={{ fontSize: 12, color: "#888" }}>⏳ Memproses...</span>}
      </div>

      {rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={th} align="left">File</th>
                <th style={th}>Intermediate</th>
                <th style={th}>Final WxH</th>
                <th style={th}>Metode</th>
                <th style={th}>Orig (KB)</th>
                <th style={th}>RIFR (KB)</th>
                <th style={th}>Out (KB)</th>
                <th style={th}>ΔSize (KB)</th>
                <th style={th}>Time (ms)</th>
                <th style={th}>PSNR (dB)</th>
                <th style={th}>MSE</th>
                <th style={th}>MAE</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={td}>{r.filename}</td>
                  <td style={td}>{r.intW}×{r.intH}</td>
                  <td style={td}>{r.w}×{r.h}</td>
                  <td style={td}>{r.method}</td>
                  <td style={td}>{(r.origBytes/1024).toFixed(2)}</td>
                  <td style={td}>{(r.rifrBytes/1024).toFixed(2)}</td>
                  <td style={td}>{(r.outBytes/1024).toFixed(2)}</td>
                  <td style={td}>{r.deltaKB.toFixed(2)}</td>
                  <td style={td}>{r.timeMs.toFixed(2)}</td>
                  <td style={td}>{isFinite(r.psnr) ? r.psnr.toFixed(2) : "∞"}</td>
                  <td style={td}>{r.mse.toExponential(3)}</td>
                  <td style={td}>{r.mae.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {summary && (
        <div style={{ fontSize: 13, background: "#f9f9f9", padding: "10px 14px", borderRadius: 10, border: "1px solid #e5e5e5" }}>
          <strong>Summary</strong><br />
          Files: {summary.count} &nbsp;|&nbsp;
          Total Time: {summary.totalTimeMs} ms &nbsp;|&nbsp;
          Total ΔSize: {summary.totalDeltaKB} KB &nbsp;|&nbsp;
          Avg PSNR: {summary.avgPSNR} dB &nbsp;|&nbsp;
          Avg MSE: {summary.avgMSE} &nbsp;|&nbsp;
          Avg MAE: {summary.avgMAE}
        </div>
      )}
    </div>
  );
}
