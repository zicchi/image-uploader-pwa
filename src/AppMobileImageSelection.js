import React, { useState } from "react";
import PureRIFR from "./PureRIFR";
import PurePica from "./PurePica";

export default function AppMobileImageSelection() {
  const [tab, setTab] = useState("rifr");

  const containerStyle = {
    minHeight: "100vh",
    background: "#fafafa",
    paddingBottom: "84px", // space for bottom nav
  };

  const navStyle = {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    height: "72px",
    background: "#ffffff",
    borderTop: "1px solid #e5e5e5",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
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
  });

  const iconDot = (active) => ({
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    background: active ? "#111" : "#ccc",
  });

  return (
    <div style={containerStyle}>
      {tab === "rifr" ? <PureRIFR /> : <PurePica />}

      <nav style={navStyle}>
        <button style={btnStyle(tab === "rifr")} onClick={() => setTab("rifr")}>
          <div style={iconDot(tab === "rifr")} />
          RIFR
        </button>
        <button style={btnStyle(tab === "pica")} onClick={() => setTab("pica")}>
          <div style={iconDot(tab === "pica")} />
          Pica
        </button>
      </nav>
    </div>
  );
}
