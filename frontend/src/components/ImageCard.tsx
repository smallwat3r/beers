import { useState } from 'preact/hooks';
import { Image as ImageType } from '../types';
import './ImageCard.css';

export const ImageCard = ({ image, onClick }: { image: ImageType, onClick: (image: ImageType) => void }) => {
  const [isLoaded, setIsLoaded] = useState(false);
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
        <img
          src={image.url}
          alt={image.metadata.beer || image.key}
          loading="lazy"
          decoding="async"
          class={isLoaded ? 'loaded' : ''}
          onLoad={() => setIsLoaded(true)}
          onError={() => setIsLoaded(true)}
        />
      </div>
    </div>
  );
};
