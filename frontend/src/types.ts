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
  // the checkin date as epoch ms, derived once when the manifest loads so that
  // sorting and date filtering never re-parse the RFC 2822 string. 0 when the
  // date is unparseable
  time: number;
  metadata: CheckinMetadata;
};

export type ImageResponse = {
  images: Image[];
};
