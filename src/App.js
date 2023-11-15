import React from 'react';
import { BrowserRouter as Router, Route, Link, Routes } from 'react-router-dom'; // Perhatikan penggunaan Routes
import UploadImageNative from './UploadImageNative';
import Home from './Home';
import UploadImage from './UploadImage';

function App() {
  return (
    <Router>
      <div>
        <nav>
          <ul>
            <li>
              <Link to="/">Beranda</Link>
            </li>
            <li>
              <Link to="/upload">Unggah Gambar dengan Libary</Link>              
            </li>
            <li>
              <Link to="/native">Unggah Gambar dengan Native</Link>
            </li>
          </ul>
        </nav>

        <Routes> {/* Gantikan Switch */}
          <Route path="/" element={<Home />} />
          <Route path="/upload" element={<UploadImage />} />
          <Route path="/native" element={<UploadImageNative />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
