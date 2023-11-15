import React, { useState } from 'react';

function UploadImageNative() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [resizedImage, setResizedImage] = useState(null);
  const [compressionTime, setCompressionTime] = useState(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (event) {
        const imageDataUrl = event.target.result;

        const img = new Image();
        img.src = imageDataUrl;

        img.onload = function () {
          const startTime = performance.now(); // Waktu mulai kompresi

          const maxWidth = 300; // Lebar maksimum yang diinginkan
          const maxHeight = 300; // Tinggi maksimum yang diinginkan

          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width / maxWidth > height / maxHeight) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            } else {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const resizedDataUrl = canvas.toDataURL('image/jpeg', 1); // Kualitas gambar dapat disesuaikan

          const endTime = performance.now(); // Waktu selesai kompresi
          const timeTaken = endTime - startTime; // Waktu yang diperlukan untuk kompresi
          setCompressionTime(timeTaken);

          setSelectedImage(imageDataUrl);
          setResizedImage(resizedDataUrl);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div>
      <label htmlFor="imageUpload">Pilih Gambar:</label>
      <input type="file" accept="image/*" id="imageUpload" onChange={handleImageUpload} />      
      {resizedImage && <img src={resizedImage} alt="Resized" />}
      {compressionTime && <p>Lama kompresi gambar: {compressionTime.toFixed(2)} ms</p>}
    </div>
  );
}

export default UploadImageNative;