import React, { useState } from 'react';
import Resizer from 'react-image-file-resizer';

function UploadImage() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [compressionTime, setCompressionTime] = useState(null);

  const resizeFile = (file) => {
    return new Promise((resolve) => {
      const startTime = performance.now(); // Waktu mulai kompresi
      Resizer.imageFileResizer(
        file,
        300, // maxWidth
        300, // maxHeight
        'JPEG', // compressFormat
        100, // quality
        0, // rotation
        (uri) => {
          const endTime = performance.now(); // Waktu selesai kompresi
          const timeTaken = endTime - startTime; // Waktu yang diperlukan untuk kompresi
          setCompressionTime(timeTaken); // Atur lama waktu kompresi ke state
          resolve(uri);
        },
        'base64' // outputType
      );
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const image = await resizeFile(file);
        setSelectedImage(image);
      } catch (err) {
        console.log(err);
      }
    }
  };

  return (
    <div>
      <label htmlFor="imageUpload">Pilih Gambar:</label>
      <input type="file" accept="image/*" id="imageUpload" onChange={handleImageUpload} />
      {selectedImage && <img src={selectedImage} alt="Uploaded" />}
      {compressionTime && <p>Lama kompresi gambar: {compressionTime.toFixed(2)} ms</p>}
    </div>
  );
}

export default UploadImage;