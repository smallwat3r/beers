import { useState, useEffect, useCallback } from 'preact/hooks';
import { Image } from '../types';

export const useImages = () => {
  const [images, setImages] = useState<Image[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastKey, setLastKey] = useState<string>('');

  const loadImages = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    setError(null);

    try {
      const url = lastKey ? `/api/images?lastKey=${encodeURIComponent(lastKey)}` : '/api/images';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      setImages(prevImages => [...prevImages, ...data.images]);
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
  }, [isLoading, hasMore, lastKey]);

  useEffect(() => {
    loadImages();
  }, []); // Initial load

    useEffect(() => {

      const handleScroll = () => {

        if (window.innerHeight + document.documentElement.scrollTop < document.documentElement.offsetHeight - 500 || isLoading) {

          return;

        }

        loadImages();

      };

  

      window.addEventListener('scroll', handleScroll);

      return () => window.removeEventListener('scroll', handleScroll);

    }, [isLoading, loadImages]);

  

    useEffect(() => {

      if (!isLoading && hasMore && document.documentElement.scrollHeight <= window.innerHeight) {

        loadImages();

      }

    }, [images, isLoading, hasMore, loadImages]);

  

    return { images, isLoading, hasMore, error, loadImages };

  };

  