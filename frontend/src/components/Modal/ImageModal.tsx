import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Image as ImageType } from '../../types';
import { StarRating } from '../StarRating/StarRating';
import './ImageModal.css';

type ImageModalProps = {
  image: ImageType;
  isLoading: boolean;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  showPrevious: boolean;
  showNext: boolean;
};

export const ImageModal = ({ image, isLoading, onClose, onNext, onPrevious, showPrevious, showNext }: ImageModalProps) => {
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchEndX, setTouchEndX] = useState(0);

  const locationParts = [
    image.metadata.venue,
    image.metadata.city,
    image.metadata.state,
    image.metadata.country,
  ].filter(Boolean); // filter out empty strings

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      onNext();
    } else if (e.key === 'ArrowLeft') {
      onPrevious();
    }
  };

  const handleTouchStart = (e: TouchEvent) => {
    setTouchStartX(e.changedTouches[0].screenX);
  };

  const handleTouchEnd = (e: TouchEvent) => {
    setTouchEndX(e.changedTouches[0].screenX);
  };

  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onNext, onPrevious]);

  useEffect(() => {
    if (touchEndX === 0) return;

    if (touchStartX > touchEndX + 50) {
      onNext();
    }

    if (touchStartX < touchEndX - 50) {
      onPrevious();
    }
  }, [touchEndX]);

  return (
    <div class="modal-overlay" onClick={onClose} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {showPrevious && <button class="prev-button" onClick={(e) => { e.stopPropagation(); onPrevious(); }}>&#10094;</button>}
      {showNext && (
        <button class="next-button" onClick={(e) => { e.stopPropagation(); onNext(); }}>
          {isLoading ? <div class="loader"></div> : <span>&#10095;</span>}
        </button>
      )}
      <div class="modal-content" onClick={(e) => e.stopPropagation()}>
        <button class="close-button" onClick={onClose}>&times;</button>
        <img src={image.url} alt={image.key} />
        <div class="image-metadata">
          <div class="metadata-body">
            <div class="metadata-section">
              <h2 class="beer-name">{image.metadata.beer}</h2>
              <p class="beer-style">{image.metadata.style} - {image.metadata.abv}% ABV</p>
              <p class="rating-display">
                <StarRating rating={image.metadata.rating} />
                <span>({image.metadata.rating}/5)</span>
              </p>
            </div>

            <div class="metadata-section">
              <h3 class="brewery-name">{image.metadata.brewery} ({image.metadata.brewery_country})</h3>
            </div>

            {image.metadata.comment && (
              <div class="metadata-section">
                <blockquote class="comment">{image.metadata.comment}</blockquote>
              </div>
            )}
          </div>

          <div class="metadata-footer">
            <p class="date">
              {new Date(image.metadata.date).toLocaleString('en-GB')}
              {image.metadata.venue !== "Untappd at Home" && (
                <span> {locationParts.join(', ')}</span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
