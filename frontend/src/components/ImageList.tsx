import { h } from 'preact';
import { Image as ImageType } from '../types';
import { StarRating } from './StarRating/StarRating';
import './ImageList.css';

type ImageListProps = {
  images: ImageType[];
  isLoading: boolean;
  onImageClick: (image: ImageType) => void;
};

export const ImageList = ({ images, isLoading, onImageClick }: ImageListProps) => {
  return (
    <div class="image-list">
      {images.map((image) => {
        const md = image.metadata;
        const location = [md.venue, md.city, md.country].filter(Boolean).join(', ');
        return (
          <div
            key={image.url}
            class="list-row"
            role="button"
            tabIndex={0}
            onClick={() => onImageClick(image)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onImageClick(image);
              }
            }}
          >
            <img
              src={image.url}
              alt={md.beer || image.key}
              loading="lazy"
              decoding="async"
            />
            <div class="list-info">
              <span class="list-title">{md.beer}</span>
              <span class="list-sub">
                {[md.brewery, md.style, md.abv && `${md.abv}%`].filter(Boolean).join(' · ')}
              </span>
              <span class="list-meta">
                <StarRating rating={md.rating} />
                <span>{new Date(md.date).toLocaleDateString('en-GB')}</span>
                {location && <span class="list-location">{location}</span>}
              </span>
            </div>
          </div>
        );
      })}
      {isLoading && <div class="list-row loader">Loading...</div>}
    </div>
  );
};
