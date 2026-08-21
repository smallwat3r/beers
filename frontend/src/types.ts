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
  metadata: CheckinMetadata;
};

export type ImageResponse = {
  images: Image[];
};
