import { Image as ImageType } from '../types';
import { ImageCard } from './ImageCard';
import './ImageGrid.css';

type ImageGridProps = {
  images: ImageType[];
  isLoading: boolean;
  hasMore: boolean;
  onImageClick: (image: ImageType) => void;
};

export const ImageGrid = ({ images, isLoading, hasMore, onImageClick }: ImageGridProps) => {
  return (
    <div class="image-grid">
      {images.map((image) => (
        <ImageCard key={image.url} image={image} onClick={onImageClick} />
      ))}
      {isLoading && hasMore && (
        <div class="image-card loader">Loading...</div>
      )}
    </div>
  );
};
