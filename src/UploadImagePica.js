import React, { useMemo, useState } from "react";
import picaLib from "pica";

const MAX_W = 800;
const MAX_H = 800;

function getTargetSize(w, h, maxW = MAX_W, maxH = MAX_H) {
  if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
  if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
  if (w < 200) { h = Math.round(h * 200 / w); w = 200; }
  if (h < 200) { w = Math.round(w * 200 / h); h = 200; }
  return { w, h };
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
    const dr = aData[i]   - bData[i];
    const dg = aData[i+1] - bData[i+1];
    const db = aData[i+2] - bData[i+2];
    mae += (Math.abs(dr) + Math.abs(dg) + Math.abs(db)) / 3;
    mse += (dr*dr + dg*dg + db*db) / 3;
  }
  mae /= n;
  mse /= n;
  const psnr = (mse === 0) ? Infinity : (20 * Math.log10(255) - 10 * Math.log10(mse));
  return { psnr, mse, mae };
}

export default function UploadImagePica() {
  const [filter, setFilter] = useState("lanczos3"); // 'hamming' | 'lanczos2' | 'lanczos3' | 'mks2013'
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const pica = useMemo(() => picaLib({ features: ["wasm", "ww", "js"] }), []);

  const processOne = async (file) => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    await new Promise((r) => (img.onload = r));

    const { w, h } = getTargetSize(img.naturalWidth, img.naturalHeight);

    // Reference untuk metrik
    const refCanvas = drawRefCanvas(img, w, h);
    const refData = refCanvas.getContext("2d").getImageData(0, 0, w, h).data;

    const t0 = performance.now();

    // Resize pakai Pica
    const outCanvas = document.createElement("canvas");
    outCanvas.width = w; outCanvas.height = h;
    await pica.resize(img, outCanvas, { filter });

    // Encode hasil ke JPEG untuk ukur ukuran file
    const outBlob = await pica.toBlob(outCanvas, "image/jpeg", 0.9);
    const outBytes = outBlob.size;

    // Ambil pixel data untuk PSNR
    const outData = outCanvas.getContext("2d").getImageData(0, 0, w, h).data;
    const { psnr, mse, mae } = computeStatsPSNR(outData, refData);

    const t1 = performance.now();

    URL.revokeObjectURL(img.src);

    return {
      method: `pica-${filter}`,
      filename: file.name,
      w, h,
      origBytes: file.size,
      outBytes,
      deltaKB: (file.size - outBytes) / 1024,
      timeMs: t1 - t0,
      psnr, mse, mae,
    };
  };

  const onChange = async (e) => {
    const files = Array.from(e.target.files || []);
    const results = [];
    for (const f of files) {
      // proses sequential biar aman di device lemah
      /* eslint-disable no-await-in-loop */
      const r = await processOne(f);
      results.push(r);
    }
    setRows(results);

    // ringkasan
    const sum = results.reduce((acc, r) => {
      acc.deltaKB += r.deltaKB;
      acc.timeMs += r.timeMs;
      acc.psnr += isFinite(r.psnr) ? r.psnr : 100;
      acc.mse += r.mse;
      acc.mae += r.mae;
      return acc;
    }, { deltaKB: 0, timeMs: 0, psnr: 0, mse: 0, mae: 0 });

    const n = results.length || 1;
    setSummary({
      count: results.length,
      totalTimeMs: sum.timeMs.toFixed(2),
      totalDeltaKB: sum.deltaKB.toFixed(2),
      avgPSNR: (sum.psnr / n).toFixed(2),
      avgMSE: (sum.mse / n).toExponential(3),
      avgMAE: (sum.mae / n).toFixed(2),
    });
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <label>
          Pica filter:&nbsp;
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="lanczos3">lanczos3</option>
            <option value="lanczos2">lanczos2</option>
            <option value="hamming">hamming</option>
            <option value="mks2013">mks2013</option>
          </select>
        </label>
        <input type="file" multiple accept="image/*" onChange={onChange} />
      </div>

      {rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th align="left">File</th>
                <th>WxH</th>
                <th>Metode</th>
                <th>Orig (KB)</th>
                <th>Out (KB)</th>
                <th>ΔSize (KB)</th>
                <th>Time (ms)</th>
                <th>PSNR (dB)</th>
                <th>MSE</th>
                <th>MAE</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.filename}</td>
                  <td>{r.w}×{r.h}</td>
                  <td>{r.method}</td>
                  <td>{(r.origBytes/1024).toFixed(2)}</td>
                  <td>{(r.outBytes/1024).toFixed(2)}</td>
                  <td>{r.deltaKB.toFixed(2)}</td>
                  <td>{r.timeMs.toFixed(2)}</td>
                  <td>{isFinite(r.psnr) ? r.psnr.toFixed(2) : "∞"}</td>
                  <td>{r.mse.toExponential(3)}</td>
                  <td>{r.mae.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {summary && (
        <div>
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
