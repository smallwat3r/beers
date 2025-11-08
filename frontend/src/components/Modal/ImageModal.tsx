import { h } from 'preact';
import { Image as ImageType } from '../../types';
import { StarRating } from '../StarRating/StarRating';
import './ImageModal.css';

type ImageModalProps = {
  image: ImageType;
  onClose: () => void;
};

export const ImageModal = ({ image, onClose }: ImageModalProps) => {
  const locationParts = [
    image.metadata.venue,
    image.metadata.city,
    image.metadata.state,
    image.metadata.country,
  ].filter(Boolean); // filter out empty strings

  return (
    <div class="modal-overlay" onClick={onClose}>
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
