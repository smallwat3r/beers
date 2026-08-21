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

  // abort any in-flight request on unmount
  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // infinite scroll: observe a sentinel below the grid instead of running work
  // on every scroll event. Recreating the observer whenever images change makes
  // observe() re-fire its initial callback, which covers both the first load
  // and pages too short to scroll. After a failure only the explicit Retry
  // button resumes loading, so a persistent error does not become a retry storm.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !stateRef.current.error) {
          loadImages();
        }
      },
      { rootMargin: '500px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [images, error, loadImages]);

  return { images, isLoading, hasMore, error, loadImages, sentinelRef };
};
