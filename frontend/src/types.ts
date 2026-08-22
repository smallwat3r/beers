export type CheckinMetadata = {
  id: string;
  beer: string;
  brewery: string;
  brewery_country: string;
  comment: string;
  rating: string;
  venue: string;
  city: string;
  state: string;
  country: string;
  latlng: string;
  date: string;
  style: string;
  abv: string;
};

export type Image = {
  url: string;
  key: string;
  // derived once when the manifest loads, so sorting and date filtering never
  // re-parse the RFC 2822 date string: epoch ms, and the UTC day as YYYY-MM-DD
  time: number;
  day: string;
  metadata: CheckinMetadata;
};

export type ImageResponse = {
  images: Image[];
};
