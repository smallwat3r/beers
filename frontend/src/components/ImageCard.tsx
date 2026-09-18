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

  return (
    <button class="image-card" onClick={() => onClick(image)}>
      <span class="image-container">
        <img
          src={image.url}
          alt={image.metadata.beer || image.key}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          class={isLoaded ? 'loaded' : ''}
          onLoad={() => setIsLoaded(true)}
          onError={() => setIsLoaded(true)}
        />
      </span>
    </button>
  );
};
