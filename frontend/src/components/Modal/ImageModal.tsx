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

// a native dialog opened with showModal: the browser traps focus, makes the
// page behind inert, closes on Escape (surfaced as the close event) and stacks
// it in the top layer, so none of that is done by hand here
export const ImageModal = ({ image, onClose, onNext, onPrevious, showPrevious, showNext }: ImageModalProps) => {
  const touchStartX = useRef(0);
  const dialogRef = useRef<HTMLDialogElement>(null);

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
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      class="modal-overlay"
      ref={dialogRef}
      aria-label={image.metadata.beer || 'Beer photo'}
      onClose={onClose}
      onKeyDown={handleKeyDown}
      // the dialog itself is the backdrop area, so a click that lands on it
      // rather than on a child is a click outside the panel
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {showPrevious && (
        <button class="prev-button" aria-label="Previous image" onClick={onPrevious} />
      )}
      {showNext && (
        <button class="next-button" aria-label="Next image" onClick={onNext} />
      )}
      <div class="modal-content">
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
    </dialog>
  );
};
