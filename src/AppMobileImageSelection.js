import React, { useState } from "react";
import PureRIFR from "./PureRIFR";
import PurePica from "./PurePica";
import PureHybrid from "./PureHybrid";

/**
 * Fetch semua gambar dari public/assets/30/ berdasarkan manifest.json,
 * lalu konversi ke array File supaya bisa diproses komponen Pure*.
 */
async function fetchAssetsFiles() {
  const res = await fetch("/assets/30/manifest.json");
  const filenames = await res.json();

  const results = await Promise.all(
    filenames.map(async (name) => {
      try {
        const r = await fetch(`/assets/30/${name}`);
        if (!r.ok) return null; // skip file 404
        const blob = await r.blob();
        if (!blob.size) return null; // skip blob kosong
        return new File([blob], name, { type: blob.type || "image/jpeg" });
      } catch {
        return null;
      }
    })
  );

  const files = results.filter(Boolean);
  if (!files.length) throw new Error("Tidak ada gambar valid di assets/30/");
  return files;
}

export default function AppMobileImageSelection() {
  const [tab, setTab]   = useState("rifr");
  const [mode, setMode] = useState("upload"); // "upload" | "assets"
  const [autoFiles, setAutoFiles]   = useState(null);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [assetError, setAssetError] = useState(null);

  // Saat mode berubah ke "assets", fetch gambar dari public/assets/30/
  const handleModeChange = async (newMode) => {
    setMode(newMode);
    setAutoFiles(null);
    setAssetError(null);

    if (newMode === "assets") {
      setLoadingAssets(true);
      try {
        const files = await fetchAssetsFiles();
        setAutoFiles(files);
      } catch (err) {
        setAssetError("Gagal load assets. Pastikan gambar sudah ada di public/assets/30/");
        console.error(err);
      } finally {
        setLoadingAssets(false);
      }
    }
  };

  // ── Styles ──────────────────────────────────────────────────────────────────
  const containerStyle = {
    minHeight: "100vh",
    background: "#fafafa",
    paddingBottom: "84px",
  };

  // Toggle mode bar (atas)
  const modeBarStyle = {
    position: "sticky",
    top: 0,
    zIndex: 60,
    background: "#fff",
    borderBottom: "1px solid #e5e5e5",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    height: "48px",
  };

  const modeBtnStyle = (active) => ({
    display: "grid",
    placeItems: "center",
    fontSize: "13px",
    fontWeight: active ? 700 : 500,
    color: active ? "#111" : "#888",
    borderTop: "none",
    borderLeft: "none",
    borderRight: "none",
    borderBottom: active ? "2px solid #111" : "2px solid transparent",
    background: "transparent",
    cursor: "pointer",
  });

  // Bottom nav
  const navStyle = {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    height: "72px",
    background: "#ffffff",
    borderTop: "1px solid #e5e5e5",
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    alignItems: "center",
    zIndex: 50,
  };

  const btnStyle = (active) => ({
    display: "grid",
    placeItems: "center",
    gap: "6px",
    padding: "8px 12px",
    fontSize: "13px",
    color: active ? "#111" : "#666",
    fontWeight: active ? 600 : 500,
    textAlign: "center",
    borderRadius: "10px",
    margin: "0 8px",
    background: active ? "#f2f2f2" : "transparent",
    border: "none",
    cursor: "pointer",
  });

  const iconDot = (active) => ({
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    background: active ? "#111" : "#ccc",
  });

  const infoStyle = {
    margin: "12px 16px 0",
    padding: "10px 14px",
    borderRadius: "10px",
    fontSize: "12px",
    background: "#f0f4ff",
    color: "#3355cc",
    border: "1px solid #c7d5ff",
  };

  const errorStyle = {
    ...infoStyle,
    background: "#fff0f0",
    color: "#cc3333",
    border: "1px solid #ffc7c7",
  };

  return (
    <div style={containerStyle}>

      {/* Toggle Mode */}
      <div style={modeBarStyle}>
        <button style={modeBtnStyle(mode === "upload")} onClick={() => handleModeChange("upload")}>
          📁 Upload
        </button>
        <button style={modeBtnStyle(mode === "assets")} onClick={() => handleModeChange("assets")}>
          🗂️ Assets / 30
        </button>
      </div>

      {/* Status info */}
      {loadingAssets && (
        <div style={infoStyle}>⏳ Mengambil 30 gambar dari assets...</div>
      )}
      {assetError && (
        <div style={errorStyle}>⚠️ {assetError}</div>
      )}
      {mode === "assets" && autoFiles && !loadingAssets && (
        <div style={infoStyle}>
          ✅ {autoFiles.length} gambar loaded dari <code>public/assets/30/</code>
        </div>
      )}

      {/* Konten tab aktif */}
      {tab === "rifr"   ? <PureRIFR   autoFiles={mode === "assets" ? autoFiles : null} /> :
       tab === "pica"   ? <PurePica   autoFiles={mode === "assets" ? autoFiles : null} /> :
       <PureHybrid      autoFiles={mode === "assets" ? autoFiles : null} />}

      {/* Bottom Nav */}
      <nav style={navStyle}>
        <button style={btnStyle(tab === "rifr")} onClick={() => setTab("rifr")}>
          <div style={iconDot(tab === "rifr")} />
          RIFR
        </button>
        <button style={btnStyle(tab === "pica")} onClick={() => setTab("pica")}>
          <div style={iconDot(tab === "pica")} />
          Pica
        </button>
        <button style={btnStyle(tab === "hybrid")} onClick={() => setTab("hybrid")}>
          <div style={iconDot(tab === "hybrid")} />
          Hybrid
        </button>
      </nav>
    </div>
  );
}
