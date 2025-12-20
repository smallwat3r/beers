import { useState, useEffect, h, Fragment } from 'preact/hooks';
import { Image as ImageType } from '../types';
import './ImageCard.css';

export const ImageCard = ({ image, onClick }: { image: ImageType, onClick: (image: ImageType) => void }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const img = new window.Image();

    img.onload = () => {
      if (!cancelled) setIsLoaded(true);
    };
    img.onerror = () => {
      if (!cancelled) setIsLoaded(true);
    };
    img.src = image.url;

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
      img.src = '';
    };
  }, [image.url]);

  return (
    <div class="image-card" onClick={() => onClick(image)}>
      <div class="image-container">
        {isLoaded ? <img src={image.url} alt={image.key} /> : <div class="image-placeholder" />}
      </div>
    </div>
  );
};
