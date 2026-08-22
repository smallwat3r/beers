import { h } from 'preact';
import { useMemo, useRef } from 'preact/hooks';
import Select from 'react-select';
import { Image } from '../types';
import './FilterBar.css';

export type Filters = {
  brewery: string;
  style: string;
  country: string;
  city: string;
  venue: string;
  dateFrom: string;
  dateTo: string;
  ratingMin: string;
  ratingMax: string;
  abvMin: string;
  abvMax: string;
};

export const emptyFilters: Filters = {
  brewery: '',
  style: '',
  country: '',
  city: '',
  venue: '',
  dateFrom: '',
  dateTo: '',
  ratingMin: '',
  ratingMax: '',
  abvMin: '',
  abvMax: '',
};

// "Untappd at Home" is a virtual venue pinned to the United States, so its
// country is meaningless for filtering
export const countryOf = (img: Image): string =>
  img.metadata.venue === 'Untappd at Home' ? '' : img.metadata.country;

// checkin ratings are strings like "3.5" out of 5
const RATING_STEPS = ['1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'];

// coarse ladder rather than every distinct strength in the data, which runs to
// hundreds of decimals; anything above 15% is a rare barrel-aged outlier
const ABV_STEPS = ['3', '4', '5', '6', '7', '8', '9', '10', '12', '15', '20'];

export const matchesFilters = (img: Image, f: Filters): boolean => {
  // img.day is "YYYY-MM-DD" (UTC), so date range checks are string comparison
  const day = img.day;
  const rating = parseFloat(img.metadata.rating);
  const abv = parseFloat(img.metadata.abv);
  return (
    (!f.brewery || img.metadata.brewery === f.brewery) &&
    (!f.style || img.metadata.style === f.style) &&
    (!f.country || countryOf(img) === f.country) &&
    (!f.city || img.metadata.city === f.city) &&
    (!f.venue || img.metadata.venue === f.venue) &&
    (!f.dateFrom || (day !== '' && day >= f.dateFrom)) &&
    (!f.dateTo || (day !== '' && day <= f.dateTo)) &&
    (!f.ratingMin || rating >= parseFloat(f.ratingMin)) &&
    (!f.ratingMax || rating <= parseFloat(f.ratingMax)) &&
    (!f.abvMin || abv >= parseFloat(f.abvMin)) &&
    (!f.abvMax || abv <= parseFloat(f.abvMax))
  );
};

const uniqSorted = (values: string[]) =>
  [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

type Option = { value: string; label: string };

const toOptions = (values: string[]): Option[] =>
  values.map((v) => ({ value: v, label: v }));

const toValue = (v: string): Option | null => (v ? { value: v, label: v } : null);

const toPercentOptions = (values: string[]): Option[] =>
  values.map((v) => ({ value: v, label: `${v}%` }));

const toPercentValue = (v: string): Option | null => (v ? { value: v, label: `${v}%` } : null);

// fixed ladders, built once rather than on every render
const RATING_OPTIONS = toOptions(RATING_STEPS);
const ABV_OPTIONS = toPercentOptions(ABV_STEPS);

type FilterBarProps = {
  images: Image[];
  filters: Filters;
  open: boolean;
  onClose: () => void;
  onChange: (filters: Filters) => void;
};

export const FilterBar = ({ images, filters, open, onClose, onChange }: FilterBarProps) => {
  // scanning every checkin five times is the most expensive thing this
  // component does, and the answer only changes when the manifest does
  const searchFields = useMemo<{
    key: keyof Filters;
    label: string;
    options: Option[];
    wide?: boolean;
  }[]>(() => {
    const optionsOf = (get: (img: Image) => string) =>
      toOptions(uniqSorted(images.map(get)));
    return [
      { key: 'brewery', label: 'Brewery', options: optionsOf((i) => i.metadata.brewery), wide: true },
      { key: 'style', label: 'Style', options: optionsOf((i) => i.metadata.style), wide: true },
      { key: 'country', label: 'Country', options: optionsOf(countryOf) },
      { key: 'city', label: 'City', options: optionsOf((i) => i.metadata.city) },
      { key: 'venue', label: 'Venue', options: optionsOf((i) => i.metadata.venue), wide: true },
    ];
  }, [images]);

  const setField = (key: keyof Filters, value: string) =>
    onChange({ ...filters, [key]: value });

  // open the native calendar on click anywhere in the input, not just the
  // tiny picker icon; older browsers without showPicker just focus the field
  const openPicker = (e: MouseEvent) => {
    const el = e.currentTarget as HTMLInputElement;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
      } catch {
        /* needs a user gesture or unsupported; the input still works typed */
      }
    }
  };

  // swipe up on the expanded mobile panel closes it; swipes inside an open
  // dropdown menu are ignored so scrolling the option list stays usable
  const touchStartY = useRef(0);
  const onTouchStart = (e: TouchEvent) => {
    touchStartY.current = e.changedTouches[0].screenY;
  };
  const onTouchEnd = (e: TouchEvent) => {
    if ((e.target as Element).closest('.rs__menu')) return;
    if (touchStartY.current - e.changedTouches[0].screenY > 50) {
      onClose();
    }
  };

  return (
    <div class={`filter-bar ${open ? 'open' : ''}`}>
      <div class="filter-controls" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {searchFields.map(({ key, label, options, wide }) => (
          <Select
            key={key}
            className={`filter-select${wide ? ' wide' : ''}`}
            classNamePrefix="rs"
            placeholder={label}
            aria-label={label}
            isClearable
            options={options}
            value={toValue(filters[key])}
            onChange={(opt) => setField(key, opt?.value ?? '')}
          />
        ))}
        <span class="filter-range">
          {/* visible labels: iOS renders an empty date input as blank text,
              so without these the fields are invisible until focused */}
          <label class="filter-date">
            <span>From</span>
            <input
              type="date"
              onClick={openPicker}
              value={filters.dateFrom}
              onChange={(e) => setField('dateFrom', (e.target as HTMLInputElement).value)}
            />
          </label>
          <label class="filter-date">
            <span>To</span>
            <input
              type="date"
              onClick={openPicker}
              value={filters.dateTo}
              onChange={(e) => setField('dateTo', (e.target as HTMLInputElement).value)}
            />
          </label>
        </span>
        <span class="filter-range">
          <Select
            className="filter-select compact"
            classNamePrefix="rs"
            placeholder="Min rating"
            aria-label="Minimum rating"
            isClearable
            isSearchable={false}
            options={RATING_OPTIONS}
            value={toValue(filters.ratingMin)}
            onChange={(opt) => setField('ratingMin', opt?.value ?? '')}
          />
          <span aria-hidden="true">-</span>
          <Select
            className="filter-select compact"
            classNamePrefix="rs"
            placeholder="Max rating"
            aria-label="Maximum rating"
            isClearable
            isSearchable={false}
            options={RATING_OPTIONS}
            value={toValue(filters.ratingMax)}
            onChange={(opt) => setField('ratingMax', opt?.value ?? '')}
          />
        </span>
        <span class="filter-range">
          <Select
            className="filter-select compact"
            classNamePrefix="rs"
            placeholder="Min ABV"
            aria-label="Minimum ABV"
            isClearable
            isSearchable={false}
            options={ABV_OPTIONS}
            value={toPercentValue(filters.abvMin)}
            onChange={(opt) => setField('abvMin', opt?.value ?? '')}
          />
          <span aria-hidden="true">-</span>
          <Select
            className="filter-select compact"
            classNamePrefix="rs"
            placeholder="Max ABV"
            aria-label="Maximum ABV"
            isClearable
            isSearchable={false}
            options={ABV_OPTIONS}
            value={toPercentValue(filters.abvMax)}
            onChange={(opt) => setField('abvMax', opt?.value ?? '')}
          />
        </span>
        {Object.values(filters).some(Boolean) && (
          <button
            class="filter-clear"
            onClick={() => {
              onChange(emptyFilters);
              onClose();
            }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};
