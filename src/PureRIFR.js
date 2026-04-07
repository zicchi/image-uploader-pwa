import React, { useState, useEffect, useRef } from "react";
import Resizer from "react-image-file-resizer";

/** Object URL pool cleanup */
function useObjectURLPool() {
  const pool = useRef([]);
  useEffect(() => () => pool.current.forEach((u) => URL.revokeObjectURL(u)), []);
  return (blobOrFile) => {
    const url = URL.createObjectURL(blobOrFile);
    pool.current.push(url);
    return url;
  };
}

function bytesToKB(b) {
  return (b / 1024).toFixed(1);
}

function getTargetSize(w, h, { maxW = 800, maxH = 800, minW = 1, minH = 1 } = {}) {
  let width = w, height = h;
  if (width > maxW) { height = Math.round((height * maxW) / width); width = maxW; }
  if (height > maxH) { width = Math.round((width * maxH) / height); height = maxH; }
  if (width < minW) { height = Math.round((height * minW) / width); width = minW; }
  if (height < minH) { width = Math.round((width * minH) / height); height = minH; }
  return { width, height };
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function resizerToBlob({ file, width, height, format = "JPEG", quality = 90, keepAspectRatio = true }) {
  return new Promise((resolve) => {
    Resizer.imageFileResizer(
      file,
      width,
      height,
      format,
      quality,
      0,
      (uri) => resolve(uri),
      "blob",
      width,
      height,
      keepAspectRatio,
      true // web worker
    );
  });
}

export default function PureRIFR() {
  const [items, setItems] = useState([]);
  const [opts, setOpts] = useState({
    maxW: 800,
    maxH: 800,
    quality: 90,
    format: "JPEG",
    keepAspectRatio: true,
  });

  const makeUrl = useObjectURLPool();

  const wrapStyle = {
    padding: "16px",
    display: "grid",
    gap: "16px",
    maxWidth: "720px",
    margin: "0 auto",
    background: "#fafafa",
  };

  const cardStyle = {
    border: "1px solid #e9e9e9",
    borderRadius: "16px",
    background: "#fff",
    padding: "14px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    display: "grid",
    gap: "12px",
  };

  const rowStyle = { display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end" };
  const labelCol = { display: "grid", gap: "6px", fontSize: "13px" };
  const inputBase = {
    border: "1px solid #ddd",
    borderRadius: "8px",
    padding: "8px 10px",
    width: "120px",
    fontSize: "14px",
    outline: "none",
  };
  const selectBase = { ...inputBase, width: "140px" };
  const checkboxRow = { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" };

  const headerStyle = { fontSize: "16px", fontWeight: 700 };
  const gridImages = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  };
  const figStyle = { display: "flex", flexDirection: "column", gap: "8px" };
  const imgStyle = {
    width: "100%",
    height: "220px",
    objectFit: "contain",
    background: "#f5f5f5",
    borderRadius: "10px",
  };
  const small = { fontSize: "12px", color: "#666" };
  const btn = {
    padding: "8px 12px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 600,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    textDecoration: "none",
    display: "inline-block",
  };

  const onPickFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const out = [];
    for (const file of files) {
      const img = await readImage(file);
      const { width, height } = getTargetSize(img.naturalWidth, img.naturalHeight, {
        maxW: opts.maxW, maxH: opts.maxH, minW: 1, minH: 1,
      });
      const blob = await resizerToBlob({
        file,
        width,
        height,
        format: opts.format,
        quality: opts.quality,
        keepAspectRatio: opts.keepAspectRatio,
      });
      out.push({
        name: file.name,
        beforeUrl: makeUrl(file),
        beforeSize: file.size,
        afterUrl: makeUrl(blob),
        afterSize: blob.size,
        dimsText: `${width}×${height}`,
      });
    }
    setItems(out);
    e.target.value = "";
  };

  return (
    <section style={wrapStyle}>
      <h2 style={headerStyle}>React Image File Resizer — Compression</h2>

      <div style={{ ...cardStyle }}>
        <div style={rowStyle}>
          <label style={labelCol}>
            Max width
            <input
              type="number"
              style={inputBase}
              value={opts.maxW}
              min={1}
              onChange={(e) => setOpts((o) => ({ ...o, maxW: Number(e.target.value || 0) }))}
            />
          </label>
          <label style={labelCol}>
            Max height
            <input
              type="number"
              style={inputBase}
              value={opts.maxH}
              min={1}
              onChange={(e) => setOpts((o) => ({ ...o, maxH: Number(e.target.value || 0) }))}
            />
          </label>
          <label style={labelCol}>
            Quality (1–100)
            <input
              type="number"
              style={inputBase}
              value={opts.quality}
              min={1}
              max={100}
              onChange={(e) =>
                setOpts((o) => ({ ...o, quality: Math.max(1, Math.min(100, Number(e.target.value || 0))) }))
              }
            />
          </label>
          <label style={labelCol}>
            Format
            <select
              style={selectBase}
              value={opts.format}
              onChange={(e) => setOpts((o) => ({ ...o, format: e.target.value }))}
            >
              <option value="JPEG">JPEG</option>
              <option value="WEBP">WEBP</option>
              <option value="PNG">PNG</option>
            </select>
          </label>
          <label style={checkboxRow}>
            <input
              type="checkbox"
              checked={opts.keepAspectRatio}
              onChange={(e) => setOpts((o) => ({ ...o, keepAspectRatio: e.target.checked }))}
            />
            Keep aspect ratio
          </label>

          <label style={{ marginLeft: "auto", ...labelCol }}>
            <span>Image selection</span>
            <input type="file" accept="image/*" multiple onChange={onPickFiles} />
          </label>
        </div>
      </div>

      <div style={{ display: "grid", gap: "12px", paddingBottom: "8px" }}>
        {items.map((it, i) => (
          <div key={i} style={cardStyle}>
            <div style={{ fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={it.name}>
              {it.name}
            </div>

            <div style={gridImages}>
              <figure style={figStyle}>
                <img src={it.beforeUrl} alt="original" style={imgStyle} />
                <figcaption style={small}>Original · {bytesToKB(it.beforeSize)} KB</figcaption>
              </figure>

              <figure style={figStyle}>
                <img src={it.afterUrl} alt="compressed" style={imgStyle} />
                <figcaption style={small}>Compressed · {it.dimsText} · {bytesToKB(it.afterSize)} KB</figcaption>
              </figure>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <a href={it.afterUrl} download={`compressed-${it.name}`} style={btn}>Download</a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
