import { h } from 'preact';
import { useState } from 'preact/hooks';
import Select from 'react-select';
import { Image } from '../types';
import './FilterBar.css';

export type Filters = {
  brewery: string;
  style: string;
  country: string;
  dateFrom: string;
  dateTo: string;
  ratingMin: string;
  ratingMax: string;
};

export const emptyFilters: Filters = {
  brewery: '',
  style: '',
  country: '',
  dateFrom: '',
  dateTo: '',
  ratingMin: '',
  ratingMax: '',
};

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
    (!f.country || img.metadata.country === f.country) &&
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
  onChange: (filters: Filters) => void;
};

export const FilterBar = ({ images, filters, onChange }: FilterBarProps) => {
  // on small screens the controls collapse behind this toggle
  const [open, setOpen] = useState(false);

  const searchFields: { key: keyof Filters; label: string; options: string[] }[] = [
    { key: 'brewery', label: 'Brewery', options: uniqSorted(images.map((i) => i.metadata.brewery)) },
    { key: 'style', label: 'Style', options: uniqSorted(images.map((i) => i.metadata.style)) },
    { key: 'country', label: 'Country', options: uniqSorted(images.map((i) => i.metadata.country)) },
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

  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <div class={`filter-bar ${open ? 'open' : ''}`}>
      <button
        class="filter-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Filters{activeCount > 0 ? ` (${activeCount})` : ''} {open ? '▴' : '▾'}
      </button>
      <div class="filter-controls">
        {searchFields.map(({ key, label, options }) => (
          <Select
            key={key}
            className="filter-select"
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
          <input
            type="date"
            aria-label="From date"
            onClick={openPicker}
            value={filters.dateFrom}
            onChange={(e) => setField('dateFrom', (e.target as HTMLInputElement).value)}
          />
          <span aria-hidden="true">-</span>
          <input
            type="date"
            aria-label="To date"
            onClick={openPicker}
            value={filters.dateTo}
            onChange={(e) => setField('dateTo', (e.target as HTMLInputElement).value)}
          />
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
        {activeCount > 0 && (
          <button class="filter-clear" onClick={() => onChange(emptyFilters)}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
};
