import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import './app.css';
import {
  FilterBar,
  Filters,
  countryOf,
  emptyFilters,
  matchesFilters,
} from './components/FilterBar';
import { ImageGrid } from './components/ImageGrid';
import { ImageList } from './components/ImageList';
import { ImageModal } from './components/Modal/ImageModal';
import { useImages } from './hooks/useImages';
import { Image as ImageType } from './types';

// how many cards each scroll step adds; all data is already in memory, this
// only paces DOM growth
const PAGE_SIZE = 60;

// unrated check-ins sort as 0, so they land at the low-rating end
const byRating = (img: ImageType) => parseFloat(img.metadata.rating) || 0;

// unparseable dates carry time 0, so they land at the oldest end
const byDate = (img: ImageType) => img.time;

// the manifest arrives newest first, so "" (no comparator) is date descending
const SORTS: Record<string, (a: ImageType, b: ImageType) => number> = {
  'rating-desc': (a, b) => byRating(b) - byRating(a),
  'rating-asc': (a, b) => byRating(a) - byRating(b),
  'date-asc': (a, b) => byDate(a) - byDate(b),
};

export function App() {
  const { images, isLoading, error, retry } = useImages();
  const [selectedImage, setSelectedImage] = useState<ImageType | null>(null);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [renderCount, setRenderCount] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState('');
  const [view, setView] = useState<'grid' | 'list'>(
    () => (localStorage.getItem('beers-view') === 'list' ? 'list' : 'grid'),
  );

  const changeView = (v: 'grid' | 'list') => {
    setView(v);
    localStorage.setItem('beers-view', v);
  };

  const visible = useMemo(() => {
    const filtered = images.filter((img) => matchesFilters(img, filters));
    const compare = SORTS[sort];
    return compare ? filtered.sort(compare) : filtered;
  }, [images, filters, sort]);

  // unique counts over the filtered set, so the line doubles as a result count
  const stats = useMemo(() => {
    const uniq = (get: (img: ImageType) => string) =>
      new Set(visible.map(get).filter(Boolean)).size;
    return {
      checkins: visible.length,
      beers: uniq((img) => img.metadata.beer),
      breweries: uniq((img) => img.metadata.brewery),
      styles: uniq((img) => img.metadata.style),
      places: uniq((img) => img.metadata.venue),
      cities: uniq((img) => img.metadata.city),
      countries: uniq(countryOf),
    };
  }, [visible]);
  const rendered = visible.slice(0, renderCount);
  const hasMore = renderCount < visible.length;

  // start the window over when filters change so the grid begins at the top
  // of the new result set
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

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
      <div class="top-bar">
        <div class="toolbar">
          <div class="toolbar-actions">
            <button
              class="filter-toggle"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}{' '}
              {filtersOpen ? '▴' : '▾'}
            </button>
            <select
              class="filter-toggle sort-select"
              aria-label="Sort"
              value={sort}
              onChange={(e) => {
                setSort((e.target as HTMLSelectElement).value);
                setRenderCount(PAGE_SIZE);
              }}
            >
              <option value="">Date: newest first</option>
              <option value="date-asc">Date: oldest first</option>
              <option value="rating-desc">Rating: high to low</option>
              <option value="rating-asc">Rating: low to high</option>
            </select>
            <div class="view-toggle" role="group" aria-label="View">
              <button
                class={view === 'grid' ? 'active' : ''}
                aria-pressed={view === 'grid'}
                onClick={() => changeView('grid')}
              >
                Grid
              </button>
              <button
                class={view === 'list' ? 'active' : ''}
                aria-pressed={view === 'list'}
                onClick={() => changeView('list')}
              >
                List
              </button>
            </div>
          </div>
        </div>
        <FilterBar
          images={images}
          filters={filters}
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          onChange={changeFilters}
        />
        {!isLoading && visible.length > 0 && (
          <p class="stats">
            {stats.checkins} check-ins · {stats.beers} beers · {stats.breweries} breweries ·{' '}
            {stats.styles} styles · {stats.places} places · {stats.cities} cities ·{' '}
            {stats.countries} countries
          </p>
        )}
      </div>
      {view === 'grid' ? (
        <ImageGrid images={rendered} isLoading={isLoading} onImageClick={openModal} />
      ) : (
        <ImageList images={rendered} isLoading={isLoading} onImageClick={openModal} />
      )}
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
