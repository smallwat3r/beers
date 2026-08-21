import { h, Fragment } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import './app.css';
import { FilterBar, Filters, emptyFilters, matchesFilters } from './components/FilterBar';
import { ImageGrid } from './components/ImageGrid';
import { ImageModal } from './components/Modal/ImageModal';
import { useImages } from './hooks/useImages';
import { Image as ImageType } from './types';

// how many cards each scroll step adds; all data is already in memory, this
// only paces DOM growth
const PAGE_SIZE = 60;

export function App() {
  const { images, isLoading, error, retry } = useImages();
  const [selectedImage, setSelectedImage] = useState<ImageType | null>(null);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [renderCount, setRenderCount] = useState(PAGE_SIZE);

  const visible = useMemo(
    () => images.filter((img) => matchesFilters(img, filters)),
    [images, filters],
  );

  // unique counts over the filtered set, so the line doubles as a result count
  const stats = useMemo(() => {
    const uniq = (get: (img: ImageType) => string) =>
      new Set(visible.map(get).filter(Boolean)).size;
    return {
      checkins: visible.length,
      beers: uniq((img) => img.metadata.beer),
      breweries: uniq((img) => img.metadata.brewery),
      countries: uniq((img) => img.metadata.country),
    };
  }, [visible]);
  const rendered = visible.slice(0, renderCount);
  const hasMore = renderCount < visible.length;

  // start the window over when filters change so the grid begins at the top
  // of the new result set
  const changeFilters = (f: Filters) => {
    setFilters(f);
    setRenderCount(PAGE_SIZE);
  };

  const openModal = (image: ImageType) => {
    setSelectedImage(image);
  };

  const closeModal = () => {
    setSelectedImage(null);
  };

  // the modal navigates the full filtered list, not just the rendered window
  const currentIndex = selectedImage
    ? visible.findIndex((img) => img.key === selectedImage.key)
    : -1;

  const handleNext = () => {
    if (currentIndex >= 0 && currentIndex < visible.length - 1) {
      setSelectedImage(visible[currentIndex + 1]);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setSelectedImage(visible[currentIndex - 1]);
    }
  };

  // warm the browser cache for the neighbouring images while the modal is
  // open, so arrow navigation does not show a blank frame
  useEffect(() => {
    if (currentIndex < 0) return;
    [visible[currentIndex + 1], visible[currentIndex - 1]].forEach((img) => {
      if (img) new window.Image().src = img.url;
    });
  }, [currentIndex, visible]);

  // infinite scroll over the already-loaded data: reveal another window of
  // cards when the sentinel comes into view. Recreating the observer on each
  // window change makes observe() re-fire its initial callback, which covers
  // pages too short to scroll.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setRenderCount((count) => count + PAGE_SIZE);
        }
      },
      { rootMargin: '500px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, renderCount]);

  return (
    <div class="app">
      <FilterBar images={images} filters={filters} onChange={changeFilters} />
      {!isLoading && visible.length > 0 && (
        <p class="stats">
          {stats.checkins} check-ins · {stats.beers} beers · {stats.breweries} breweries ·{' '}
          {stats.countries} countries
        </p>
      )}
      <ImageGrid images={rendered} isLoading={isLoading} onImageClick={openModal} />
      {visible.length === 0 && !isLoading && !error && (
        <p class="no-results">No matching beers.</p>
      )}
      <div ref={sentinelRef} class="scroll-sentinel" aria-hidden="true" />
      {error && (
        <div class="error-banner" role="alert">
          <span>Could not load images.</span>
          <button onClick={retry}>Retry</button>
        </div>
      )}
      {selectedImage && (
        <ImageModal
          image={selectedImage}
          onClose={closeModal}
          onNext={handleNext}
          onPrevious={handlePrevious}
          showPrevious={currentIndex > 0}
          showNext={currentIndex >= 0 && currentIndex < visible.length - 1}
        />
      )}
    </div>
  );
}
