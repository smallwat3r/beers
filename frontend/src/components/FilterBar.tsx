import { useMemo, useRef, useState } from 'preact/hooks';
import { Image } from '../types';
import './FilterBar.css';

export type Filters = {
  beer: string;
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
  beer: '',
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

// the beer option carries the brewery and style so same-named beers stay
// distinct and typing either narrows the beer list; empty parts are dropped.
// The list renders everything after the first separator as a second line
const beerLabel = (img: Image): string =>
  [img.metadata.beer, img.metadata.brewery, img.metadata.style]
    .filter(Boolean)
    .join(' · ');

// checkin ratings are strings like "3.5" out of 5
const RATING_STEPS = ['1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'];

// coarse ladder rather than every distinct strength in the data, which runs to
// hundreds of decimals; anything above 15% is a rare barrel-aged outlier
const ABV_STEPS = ['3', '4', '5', '6', '7', '8', '9', '10', '12', '15', '20'];

const DAY_MS = 24 * 60 * 60 * 1000;

export const matchesFilters = (img: Image, f: Filters): boolean => {
  const rating = parseFloat(img.metadata.rating);
  const abv = parseFloat(img.metadata.abv);
  return (
    (!f.beer || beerLabel(img) === f.beer) &&
    (!f.brewery || img.metadata.brewery === f.brewery) &&
    (!f.style || img.metadata.style === f.style) &&
    (!f.country || countryOf(img) === f.country) &&
    (!f.city || img.metadata.city === f.city) &&
    (!f.venue || img.metadata.venue === f.venue) &&
    // the bounds are "YYYY-MM-DD", which Date parses as UTC midnight, so the
    // upper one covers the whole day it names
    (!f.dateFrom || (img.time > 0 && img.time >= Date.parse(f.dateFrom))) &&
    (!f.dateTo || (img.time > 0 && img.time < Date.parse(f.dateTo) + DAY_MS)) &&
    (!f.ratingMin || rating >= parseFloat(f.ratingMin)) &&
    (!f.ratingMax || rating <= parseFloat(f.ratingMax)) &&
    (!f.abvMin || abv >= parseFloat(f.abvMin)) &&
    (!f.abvMax || abv <= parseFloat(f.abvMax))
  );
};

const uniqSorted = (values: string[]) =>
  [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

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
    options: string[];
    valid: Set<string>;
    wide?: boolean;
  }[]>(() => {
    const optionsOf = (get: (img: Image) => string) => uniqSorted(images.map(get));
    const field = (key: keyof Filters, label: string, get: (img: Image) => string,
                   wide?: boolean) => {
      const options = optionsOf(get);
      return { key, label, options, valid: new Set(options), wide };
    };
    return [
      field('beer', 'Beer', beerLabel, true),
      field('brewery', 'Brewery', (i) => i.metadata.brewery, true),
      field('style', 'Style', (i) => i.metadata.style, true),
      field('country', 'Country', countryOf),
      field('city', 'City', (i) => i.metadata.city),
      field('venue', 'Venue', (i) => i.metadata.venue, true),
    ];
  }, [images]);

  const setField = (key: keyof Filters, value: string) =>
    onChange({ ...filters, [key]: value });

  // what is in the search boxes, which is not the same as what is filtering:
  // half-typed text filters nothing, only an exact option does. Keeping it here
  // rather than reading it back off the input means a re-render mid-typing, one
  // scroll step is enough, cannot wipe what the user is in the middle of typing
  const [typed, setTyped] = useState<Partial<Record<keyof Filters, string>>>({});

  const typeInto = (key: keyof Filters, value: string, valid: Set<string>) => {
    setTyped((t) => ({ ...t, [key]: value }));
    const next = valid.has(value) ? value : '';
    if (next !== filters[key]) setField(key, next);
  };

  // which search box has its list open, and which row in it is highlighted
  const [openKey, setOpenKey] = useState<keyof Filters | null>(null);
  const [active, setActive] = useState(0);

  const pick = (key: keyof Filters, value: string) => {
    setTyped((t) => ({ ...t, [key]: value }));
    setField(key, value);
    setOpenKey(null);
  };

  // the list shows everything by default and narrows as the user types, on
  // substring rather than prefix so "flint" finds "Two Flints". Only clicking a
  // row, or typing one out in full, actually filters
  const shown = (key: keyof Filters, options: string[]) => {
    const q = (typed[key] ?? filters[key]).toLowerCase();
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  };

  const onSearchKey = (e: KeyboardEvent, key: keyof Filters, options: string[]) => {
    const list = shown(key, options);
    if (e.key === 'Escape') {
      setOpenKey(null);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpenKey(key);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (list.length ? (i + step + list.length) % list.length : 0));
    } else if (e.key === 'Enter' && openKey === key && list[active]) {
      e.preventDefault();
      pick(key, list[active]);
    }
  };

  const rangeSelect = (
    key: keyof Filters,
    label: string,
    steps: string[],
    suffix = '',
  ) => (
    <select
      class="filter-select compact"
      aria-label={label}
      value={filters[key]}
      onChange={(e) => setField(key, (e.target as HTMLSelectElement).value)}
    >
      <option value="">{label}</option>
      {steps.map((s) => (
        <option key={s} value={s}>{s}{suffix}</option>
      ))}
    </select>
  );

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

  // swipe up on the expanded mobile panel closes it
  const touchStartY = useRef(0);
  const onTouchStart = (e: TouchEvent) => {
    touchStartY.current = e.changedTouches[0].screenY;
  };
  const onTouchEnd = (e: TouchEvent) => {
    if ((e.target as Element).closest('.filter-menu')) return;
    if (touchStartY.current - e.changedTouches[0].screenY > 50) {
      onClose();
    }
  };

  return (
    <div class={`filter-bar ${open ? 'open' : ''}`}>
      <div class="filter-controls" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {searchFields.map(({ key, label, options, valid, wide }) => (
          <div key={key} class={`filter-field${wide ? ' wide' : ''}`}>
            <input
              type="search"
              class="filter-select"
              role="combobox"
              aria-expanded={openKey === key}
              aria-controls={`${key}-menu`}
              placeholder={label}
              aria-label={label}
              autocomplete="off"
              value={typed[key] ?? filters[key]}
              aria-autocomplete="list"
              onFocus={() => { setOpenKey(key); setActive(0); }}
              onClick={() => setOpenKey(key)}
              onBlur={() => setOpenKey(null)}
              onKeyDown={(e) => onSearchKey(e, key, options)}
              onInput={(e) => {
                setOpenKey(key);
                setActive(0);
                typeInto(key, (e.target as HTMLInputElement).value, valid);
              }}
            />
            {openKey === key && (
              /* every option is rendered, around 1100 for breweries, which is
                 well inside what the browser handles in one frame. Windowing
                 would only be worth it an order of magnitude further up */
              <ul class="filter-menu" id={`${key}-menu`} role="listbox">
                {shown(key, options).map((o, i) => {
                  const [head, ...sub] = o.split(' · ');
                  return (
                    <li
                      key={o}
                      role="option"
                      aria-selected={filters[key] === o}
                      class={i === active ? 'active' : ''}
                      ref={i === active
                        ? (el) => el?.scrollIntoView({ block: 'nearest' })
                        : undefined}
                      /* mousedown, not click: the input's blur would otherwise
                         close the list before the click landed */
                      onMouseDown={(e) => { e.preventDefault(); pick(key, o); }}
                    >
                      {head}
                      {sub.length > 0 && (
                        <span class="option-sub">{sub.join(' · ')}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
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
          {rangeSelect('ratingMin', 'Min rating', RATING_STEPS)}
          <span aria-hidden="true">-</span>
          {rangeSelect('ratingMax', 'Max rating', RATING_STEPS)}
        </span>
        <span class="filter-range">
          {rangeSelect('abvMin', 'Min ABV', ABV_STEPS, '%')}
          <span aria-hidden="true">-</span>
          {rangeSelect('abvMax', 'Max ABV', ABV_STEPS, '%')}
        </span>
        {Object.values(filters).some(Boolean) && (
          <button
            class="filter-clear"
            onClick={() => {
              setTyped({});
              setOpenKey(null);
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
