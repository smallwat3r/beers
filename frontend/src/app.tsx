import { h, Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import './app.css';
import { ImageGrid } from './components/ImageGrid';
import { ImageModal } from './components/Modal/ImageModal';
import { useImages } from './hooks/useImages';
import { Image as ImageType } from './types';

export function App() {
  const { images, isLoading, hasMore, loadImages } = useImages();
  const [selectedImage, setSelectedImage] = useState<ImageType | null>(null);
  const [shouldAdvance, setShouldAdvance] = useState(false);

  const openModal = (image: ImageType) => {
    setSelectedImage(image);
  };

  const closeModal = () => {
    setSelectedImage(null);
  };

  const handleNext = () => {
    if (selectedImage) {
      const currentIndex = images.findIndex((img) => img.key === selectedImage.key);
      if (currentIndex < images.length - 1) {
        setSelectedImage(images[currentIndex + 1]);
      } else if (hasMore && !isLoading) {
        setShouldAdvance(true);
        loadImages();
      }
    }
  };

  const handlePrevious = () => {
    if (selectedImage) {
      const currentIndex = images.findIndex((img) => img.key === selectedImage.key);
      if (currentIndex > 0) {
        setSelectedImage(images[currentIndex - 1]);
      }
    }
  };

  useEffect(() => {
    if (shouldAdvance && !isLoading && selectedImage) {
      const currentIndex = images.findIndex((img) => img.key === selectedImage.key);
      if (currentIndex < images.length - 1) {
        setSelectedImage(images[currentIndex + 1]);
        setShouldAdvance(false);
      }
    }
  }, [images, isLoading, shouldAdvance, selectedImage]);

  const currentIndex = selectedImage ? images.findIndex((img) => img.key === selectedImage.key) : -1;

  return (
    <div class="app">
      <ImageGrid images={images} isLoading={isLoading} hasMore={hasMore} onImageClick={openModal} />
      {selectedImage && (
        <ImageModal
          image={selectedImage}
          isLoading={isLoading}
          onClose={closeModal}
          onNext={handleNext}
          onPrevious={handlePrevious}
          showPrevious={currentIndex > 0}
          showNext={hasMore || currentIndex < images.length - 1}
        />
      )}
    </div>
  );
}
