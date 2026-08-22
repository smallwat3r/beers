import { Image as ImageType } from '../types';
import { ImageCard } from './ImageCard';
import './ImageGrid.css';

type ImageGridProps = {
  images: ImageType[];
  isLoading: boolean;
  onImageClick: (image: ImageType) => void;
};

export const ImageGrid = ({ images, isLoading, onImageClick }: ImageGridProps) => {
  return (
    <div class="image-grid">
      {images.map((image, i) => (
        <ImageCard key={image.url} image={image} onClick={onImageClick} eager={i < 8} />
      ))}
      {isLoading && (
        <div class="image-card loader">Loading...</div>
      )}
    </div>
  );
};
