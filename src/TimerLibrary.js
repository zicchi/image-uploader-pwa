import React from 'react';
import Resizer from 'react-image-file-resizer';

const UploadImage = () => {
  const resizeFile = (file) => {
    Resizer.imageFileResizer(
      file,
      800, // maxWidth
      800, // maxHeight
      'JPEG', // compressFormat
      70, // quality
      0, // rotation
      (uri) => {
        // Handle the resized image URI here
        console.log(uri);
      },
      'base64', // outputType    
    );
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      resizeFile(file);
    });
  };

  return (
    <div>
      <input type="file" multiple onChange={handleFileChange} />
    </div>
  );
};

export default UploadImage;