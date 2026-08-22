import { useState, useEffect, useCallback } from 'preact/hooks';
import { Image, CheckinMetadata } from '../types';

// one record of the bucket manifest: the object key plus the checkin metadata,
// flattened. The uploader writes it sorted newest first, so no re-sorting here.
type ManifestRecord = CheckinMetadata & { key: string };

const base = (import.meta.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

// the manifest and the photos sit in the same public bucket, so the app reads
// them straight from R2 and fetches once at mount; retry re-runs the same fetch
export const useImages = () => {
  const [images, setImages] = useState<Image[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadImages = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${base}/index.json`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const records: ManifestRecord[] = await response.json();
      setImages(
        records.map(({ key, ...metadata }) => {
          const time = Date.parse(metadata.date);
          const valid = !Number.isNaN(time);
          return {
            url: `${base}/${key}`,
            key,
            // unparseable dates sort as 0 and match no date range
            time: valid ? time : 0,
            day: valid ? new Date(time).toISOString().slice(0, 10) : '',
            metadata,
          };
        }),
      );
    } catch (e) {
      if (e instanceof Error) {
        setError(e);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  return { images, isLoading, error, retry: loadImages };
};
