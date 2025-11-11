import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { Image } from '../types';

export const useImages = () => {
  const [images, setImages] = useState<Image[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastKey, setLastKey] = useState<string>('');

  const stateRef = useRef({ isLoading, hasMore, lastKey });
  stateRef.current = { isLoading, hasMore, lastKey };

  const loadImages = useCallback(async () => {
    const { isLoading, hasMore, lastKey } = stateRef.current;
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    setError(null);

    try {
      const url = lastKey
        ? `/api/images?lastKey=${encodeURIComponent(lastKey)}`
        : '/api/images';

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      setImages(prev => {
        const existingKeys = new Set(prev.map(img => img.key));
        const newImages = data.images.filter((img: Image) => !existingKeys.has(img.key));
        return [...prev, ...newImages];
      });
      setHasMore(data.has_more);

      if (data.images.length > 0) {
        setLastKey(data.images[data.images.length - 1].key);
      }
    } catch (e) {
      if (e instanceof Error) {
        setError(e);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // initial load
  useEffect(() => {
    loadImages();
  }, []);

  // infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      const nearBottom =
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 500;

      if (!nearBottom || stateRef.current.isLoading) return;
      loadImages();
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadImages]);

  // ensure full-page content fills viewport
  useEffect(() => {
    const isPageShort =
      document.documentElement.scrollHeight <= window.innerHeight;

    if (!isLoading && hasMore && isPageShort) {
      loadImages();
    }
  }, [images, isLoading, hasMore, loadImages]);

  return { images, isLoading, hasMore, error, loadImages };
};
