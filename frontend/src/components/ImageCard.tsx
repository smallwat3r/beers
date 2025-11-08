import { useState, useEffect, h, Fragment } from 'preact/hooks';
import { Image as ImageType } from '../types';
import './ImageCard.css';

export const ImageCard = ({ image, onClick }: { image: ImageType, onClick: (image: ImageType) => void }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const img = new window.Image();
    img.src = image.url;
    img.onload = () => setIsLoaded(true);
  }, [image.url]);

  return (
    <div class="image-card" onClick={() => onClick(image)}>
      <div class="image-container">
        {isLoaded ? <img src={image.url} alt={image.key} /> : <div class="image-placeholder" />}
      </div>
    </div>
  );
};
