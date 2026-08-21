import { useState, useEffect } from 'preact/hooks';
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

  const open = () => onClick(image);

  return (
    <div
      class="image-card"
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
    >
      <div class="image-container">
        {isLoaded
          ? <img src={image.url} alt={image.metadata.beer || image.key} />
          : <div class="image-placeholder" />}
      </div>
    </div>
  );
};
