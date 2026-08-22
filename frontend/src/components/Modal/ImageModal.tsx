import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { Image as ImageType } from '../../types';
import { StarRating } from '../StarRating/StarRating';
import './ImageModal.css';

type ImageModalProps = {
  image: ImageType;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  showPrevious: boolean;
  showNext: boolean;
};

export const ImageModal = ({ image, onClose, onNext, onPrevious, showPrevious, showNext }: ImageModalProps) => {
  const touchStartX = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);

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
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.changedTouches[0].screenX;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    const touchEndX = e.changedTouches[0].screenX;
    if (touchStartX.current > touchEndX + 50) {
      onNext();
    } else if (touchStartX.current < touchEndX - 50) {
      onPrevious();
    }
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
  }, [onNext, onPrevious, onClose]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div class="modal-overlay" onClick={onClose} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {showPrevious && (
        <button
          class="prev-button"
          aria-label="Previous image"
          onClick={(e) => { e.stopPropagation(); onPrevious(); }}
        />
      )}
      {showNext && (
        <button
          class="next-button"
          aria-label="Next image"
          onClick={(e) => { e.stopPropagation(); onNext(); }}
        />
      )}
      <div
        class="modal-content"
        role="dialog"
        aria-modal="true"
        aria-label={image.metadata.beer || 'Beer photo'}
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <button class="close-button" aria-label="Close" onClick={onClose}>&times;</button>
        <img src={image.url} alt={image.metadata.beer || image.key} />
        <div class="image-metadata">
          <div class="metadata-body">
            <div class="metadata-section">
              <h2 class="beer-name">{image.metadata.beer}</h2>
              <p class="beer-style">{image.metadata.style} - {image.metadata.abv}% ABV</p>
              <p class="rating-display">
                <StarRating rating={image.metadata.rating} />
                <span>({image.metadata.rating || '?'}/5)</span>
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
              {/* metadata dates are RFC 2822 ("Fri, 21 Aug 2026 17:57:51 +0000"),
                  which Date parses natively in all browsers */}
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
