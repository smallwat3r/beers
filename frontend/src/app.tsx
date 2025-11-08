import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import './app.css';
import { ImageGrid } from './components/ImageGrid';
import { ImageModal } from './components/Modal/ImageModal';
import { useImages } from './hooks/useImages';
import { Image as ImageType } from './types';

export function App() {
  const imageHook = useImages();
  const { images, isLoading, hasMore } = imageHook;
  const [selectedImage, setSelectedImage] = useState<ImageType | null>(null);

  const openModal = (image: ImageType) => {
    setSelectedImage(image);
  };

  const closeModal = () => {
    setSelectedImage(null);
  };

  return (
    <div class="app">
      <ImageGrid images={images} isLoading={isLoading} hasMore={hasMore} onImageClick={openModal} />
      {selectedImage && <ImageModal image={selectedImage} onClose={closeModal} />}
    </div>
  );
}
