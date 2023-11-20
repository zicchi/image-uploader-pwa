import React from 'react';

const UploadImageNative = () => {
  const downloadImage = (uri, fileName) => {
    const link = document.createElement('a');
    link.href = uri;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resizeAndDownloadImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxWidth = 800;
          const maxHeight = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          downloadImage(dataUrl, `resized_${file.name}`);
          resolve();
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    const startTime = performance.now();

    for (let file of files) {
      await resizeAndDownloadImage(file);
    }

    const endTime = performance.now();
    console.log(`Total Compression Time (Native) for ${files.length} images: ${(endTime - startTime).toFixed(2)} ms`);
  };

  return (
    <div>
      <input type="file" multiple onChange={handleFileChange} />
    </div>
  );
};

export default UploadImageNative;