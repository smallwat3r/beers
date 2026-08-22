import { h } from 'preact';
import { useRef } from 'preact/hooks';
import Select from 'react-select';
import { Image } from '../types';
import './FilterBar.css';

export type Filters = {
  brewery: string;
  style: string;
  country: string;
  city: string;
  dateFrom: string;
  dateTo: string;
  ratingMin: string;
  ratingMax: string;
};

export const emptyFilters: Filters = {
  brewery: '',
  style: '',
  country: '',
  city: '',
  dateFrom: '',
  dateTo: '',
  ratingMin: '',
  ratingMax: '',
};

// "Untappd at Home" is a virtual venue pinned to the United States, so its
// country is meaningless for filtering
export const countryOf = (img: Image): string =>
  img.metadata.venue === 'Untappd at Home' ? '' : img.metadata.country;

// checkin ratings are strings like "3.5" out of 5
const RATING_STEPS = ['1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'];

// checkin dates are RFC 2822, which Date parses natively; returns "YYYY-MM-DD"
// (UTC) so date range checks reduce to string comparison, or "" when unparseable
const dayOf = (img: Image): string => {
  const t = new Date(img.metadata.date);
  return Number.isNaN(t.getTime()) ? '' : t.toISOString().slice(0, 10);
};

export const matchesFilters = (img: Image, f: Filters): boolean => {
  const day = dayOf(img);
  const rating = parseFloat(img.metadata.rating);
  return (
    (!f.brewery || img.metadata.brewery === f.brewery) &&
    (!f.style || img.metadata.style === f.style) &&
    (!f.country || countryOf(img) === f.country) &&
    (!f.city || img.metadata.city === f.city) &&
    (!f.dateFrom || (day !== '' && day >= f.dateFrom)) &&
    (!f.dateTo || (day !== '' && day <= f.dateTo)) &&
    (!f.ratingMin || rating >= parseFloat(f.ratingMin)) &&
    (!f.ratingMax || rating <= parseFloat(f.ratingMax))
  );
};

const uniqSorted = (values: string[]) =>
  [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

type Option = { value: string; label: string };

const toOptions = (values: string[]): Option[] =>
  values.map((v) => ({ value: v, label: v }));

const toValue = (v: string): Option | null => (v ? { value: v, label: v } : null);

type FilterBarProps = {
  images: Image[];
  filters: Filters;
  open: boolean;
  onClose: () => void;
  onChange: (filters: Filters) => void;
};

export const FilterBar = ({ images, filters, open, onClose, onChange }: FilterBarProps) => {
  const searchFields: {
    key: keyof Filters;
    label: string;
    options: string[];
    wide?: boolean;
  }[] = [
    {
      key: 'brewery',
      label: 'Brewery',
      options: uniqSorted(images.map((i) => i.metadata.brewery)),
      wide: true,
    },
    {
      key: 'style',
      label: 'Style',
      options: uniqSorted(images.map((i) => i.metadata.style)),
      wide: true,
    },
    { key: 'country', label: 'Country', options: uniqSorted(images.map(countryOf)) },
    { key: 'city', label: 'City', options: uniqSorted(images.map((i) => i.metadata.city)) },
  ];

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
            options={toOptions(options)}
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
            className="filter-select rating"
            classNamePrefix="rs"
            placeholder="Min rating"
            aria-label="Minimum rating"
            isClearable
            isSearchable={false}
            options={toOptions(RATING_STEPS)}
            value={toValue(filters.ratingMin)}
            onChange={(opt) => setField('ratingMin', opt?.value ?? '')}
          />
          <span aria-hidden="true">-</span>
          <Select
            className="filter-select rating"
            classNamePrefix="rs"
            placeholder="Max rating"
            aria-label="Maximum rating"
            isClearable
            isSearchable={false}
            options={toOptions(RATING_STEPS)}
            value={toValue(filters.ratingMax)}
            onChange={(opt) => setField('ratingMax', opt?.value ?? '')}
          />
        </span>
        {Object.values(filters).some(Boolean) && (
          <button class="filter-clear" onClick={() => onChange(emptyFilters)}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
};
