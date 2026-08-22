import { useState } from 'preact/hooks';
import { Image as ImageType } from '../types';
import './ImageCard.css';

type ImageCardProps = {
  image: ImageType;
  onClick: (image: ImageType) => void;
  // above-the-fold cards load eagerly: lazy loading them delays the largest
  // paint while the browser waits for layout to confirm they are visible
  eager?: boolean;
};

export const ImageCard = ({ image, onClick, eager }: ImageCardProps) => {
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
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          class={isLoaded ? 'loaded' : ''}
          onLoad={() => setIsLoaded(true)}
          onError={() => setIsLoaded(true)}
        />
      </div>
    </div>
  );
};
