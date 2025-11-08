import { h, Fragment } from 'preact';
import './StarRating.css';

type StarRatingProps = {
  rating: number;
  maxStars?: number;
};

export const StarRating = ({ rating, maxStars = 5 }: StarRatingProps) => {
  const fullStars = Math.floor(rating);
  const fraction = rating % 1;
  const emptyStars = maxStars - fullStars - (fraction > 0 ? 1 : 0);

  return (
    <div class="star-rating">
      {[...Array(fullStars)].map((_, i) => (
        <span key={`full-${i}`} class="star full">★</span>
      ))}

      {fraction > 0 && (
        <span class="star partial" style={{ '--star-fill': `${fraction * 100}%` }}>★</span>
      )}

      {[...Array(emptyStars)].map((_, i) => (
        <span key={`empty-${i}`} class="star empty">★</span>
      ))}
    </div>
  );
};
