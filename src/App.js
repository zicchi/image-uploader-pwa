// App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./Home";
import UploadImage from "./UploadImage";
import UploadImageNative from "./UploadImageNative";
import UploadImagePica from "./UploadImagePica";
import UploadImageHybrid from "./UploadImageHybrid";
import PureRIFR from "./PureRIFR";
import PurePica from "./PurePica";
import PureHybrid from "./PureHybrid";
import AppMobileImageSelection from "./AppMobileImageSelection";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AppMobileImageSelection />} />
        <Route path="/upload" element={<UploadImage />} />
        <Route path="/native" element={<UploadImageNative />} />
        <Route path="/pica" element={<UploadImagePica />} />
        <Route path="/pure-rifr" element={<PureRIFR />} />
        <Route path="/pure-pica" element={<PurePica />} />

        {/* Hybrid: RIFR pre-shrink + Pica Lanczos/Hamming */}
        <Route path="/hybrid" element={<PureHybrid />} />
        <Route path="/hybrid-bench" element={<UploadImageHybrid />} />

        {/* Halaman mobile dengan bottom nav */}
        <Route path="/mobile" element={<AppMobileImageSelection />} />
      </Routes>
    </Router>
  );
}
