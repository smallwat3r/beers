import { h, Fragment } from 'preact';
import './StarRating.css';

type StarRatingProps = {
  rating: number;
  maxStars?: number;
};

export const StarRating = ({ rating, maxStars = 5 }: StarRatingProps) => {
  const thresholds = [1, 1.5, 2.5, 3.5, 4.25];
  const fullStars = thresholds.filter(t => rating >= t).length;
  const emptyStars = maxStars - fullStars;

  return (
    <div class="star-rating">
      {[...Array(fullStars)].map((_, i) => (
        <span key={`full-${i}`} class="star full">★</span>
      ))}
      {[...Array(emptyStars)].map((_, i) => (
        <span key={`empty-${i}`} class="star empty">☆</span>
      ))}
    </div>
  );
};
