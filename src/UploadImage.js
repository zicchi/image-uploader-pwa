import React from 'react';
import Resizer from 'react-image-file-resizer';

const UploadImage = () => {
  const downloadImage = (uri, fileName) => {
    const link = document.createElement('a');
    link.href = uri;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resizeFile = (file) => {
    return new Promise((resolve) => {
      Resizer.imageFileResizer(
        file,
        800, // maxWidth
        800, // maxHeight
        'JPEG', // compressFormat
        70, // quality
        0, // rotation
        (uri) => {
          downloadImage(uri, `resized_${file.name}`);
          resolve();
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

    for (let file of files) {
      await resizeFile(file);
    }

    const endTime = performance.now();
    console.log(`Total Compression Time (Library) for ${files.length} images: ${(endTime - startTime).toFixed(2)} ms`);
  };

  return (
    <div>
      <input type="file" multiple onChange={handleFileChange} />
    </div>
  );
};

export default UploadImage;
