import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { Image } from '../types';

export const useImages = () => {
  const [images, setImages] = useState<Image[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastKey, setLastKey] = useState<string>('');

  const stateRef = useRef({ isLoading, hasMore, lastKey, error });
  stateRef.current = { isLoading, hasMore, lastKey, error };

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadImages = useCallback(async () => {
    const { isLoading, hasMore, lastKey } = stateRef.current;
    if (isLoading || !hasMore) return;

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const url = lastKey
        ? `/api/images?lastKey=${encodeURIComponent(lastKey)}`
        : '/api/images';

      const response = await fetch(url, {
        signal: abortControllerRef.current.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // an empty page gives us no cursor to advance, so stop here rather than
      // re-requesting the same month forever (guards against has_more=true with
      // no images)
      if (data.images.length === 0) {
        setHasMore(false);
        return;
      }

      setImages(prev => {
        const existingKeys = new Set(prev.map(img => img.key));
        const newImages = data.images.filter((img: Image) => !existingKeys.has(img.key));
        return [...prev, ...newImages];
      });
      setHasMore(data.has_more);
      setLastKey(data.images[data.images.length - 1].key);
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setError(e);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // initial load and cleanup on unmount
  useEffect(() => {
    loadImages();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      const nearBottom =
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 500;

      // after a failure only the explicit Retry button resumes loading, so a
      // persistent error does not turn scrolling into a retry storm
      if (!nearBottom || stateRef.current.isLoading || stateRef.current.error) return;
      loadImages();
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadImages]);

  // ensure full-page content fills viewport
  useEffect(() => {
    const isPageShort =
      document.documentElement.scrollHeight <= window.innerHeight;

    if (!isLoading && hasMore && !error && isPageShort) {
      loadImages();
    }
  }, [images, isLoading, hasMore, error, loadImages]);

  return { images, isLoading, hasMore, error, loadImages };
};
