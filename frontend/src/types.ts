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
  lat_lng: string;
  date: string;
  style: string;
  abv: string;
};

export type Image = {
  url: string;
  last_modified: string;
  key: string;
  etag: string;
  size: number;
  storage_class: string;
  metadata: CheckinMetadata;
};

export type ImageResponse = {
  images: Image[];
  has_more: boolean;
};
