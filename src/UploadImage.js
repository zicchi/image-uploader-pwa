import React, { useState } from 'react';
import Resizer from 'react-image-file-resizer';

const UploadImage = () => {
  const [compressionInfo, setCompressionInfo] = useState({
    time: 0,
    sizeDifference: 0,
  });

  const downloadImage = (uri, fileName) => {
    const link = document.createElement('a');
    link.href = uri;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resizeFile = (file) => {
    const originalSize = file.size;

    return new Promise((resolve) => {
      Resizer.imageFileResizer(
        file,
        800, // maxWidth
        800, // maxHeight
        'JPEG', // compressFormat
        70, // quality
        0, // rotation
        (uri) => {
          const resizedImage = atob(uri.split(',')[1]);
          const resizedSize = resizedImage.length;
          const sizeDiff = (originalSize - resizedSize) / 1024; // size difference in KB

          downloadImage(uri, `resized_${file.name}`);
          resolve(sizeDiff);
        },
        'base64', // outputType
        200, // minWidth
        200 // minHeight
      );
    });
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    const startTime = performance.now();
    let totalSizeDifference = 0;

    for (let file of files) {
      const sizeDiff = await resizeFile(file);
      totalSizeDifference += sizeDiff;
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    setCompressionInfo({
      time: totalTime.toFixed(2),
      sizeDifference: totalSizeDifference.toFixed(2),
    });
  };

  return (
    <div>
      <input type="file" multiple onChange={handleFileChange} />
      <div>
        Total Compression Time (Library) for {compressionInfo.time} ms<br/>
        Total Size Difference: {compressionInfo.sizeDifference} KB
      </div>
    </div>
  );
};

export default UploadImage;