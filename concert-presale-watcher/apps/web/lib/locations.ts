import type { LocationSuggestion } from "./types";

type ConcertMarket = {
  city: string;
  state: string;
  /** City center, used as the middle of an area watch. */
  latitude: number;
  longitude: number;
};

type StateEntry = {
  name: string;
  code: string;
};

const toCitySuggestion = ({
  city,
  state,
}: ConcertMarket): LocationSuggestion => ({
  id: `city-${city.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${state.toLowerCase()}`,
  kind: "city",
  city,
  state,
  country: "US",
  label: `${city}, ${state}`,
  description: "United States",
});

const toStateSuggestion = ({ name, code }: StateEntry): LocationSuggestion => ({
  id: `state-${code.toLowerCase()}`,
  kind: "state",
  city: "",
  state: code,
  country: "US",
  label: `${name}`,
  description: `All cities in ${name}`,
});

const CONCERT_MARKETS: ConcertMarket[] = [
  { city: "Albuquerque", state: "NM", latitude: 35.08, longitude: -106.65 },
  { city: "Anaheim", state: "CA", latitude: 33.84, longitude: -117.91 },
  { city: "Ann Arbor", state: "MI", latitude: 42.28, longitude: -83.74 },
  { city: "Asbury Park", state: "NJ", latitude: 40.22, longitude: -74.01 },
  { city: "Atlanta", state: "GA", latitude: 33.75, longitude: -84.39 },
  { city: "Austin", state: "TX", latitude: 30.27, longitude: -97.74 },
  { city: "Baltimore", state: "MD", latitude: 39.29, longitude: -76.61 },
  { city: "Berkeley", state: "CA", latitude: 37.87, longitude: -122.27 },
  { city: "Birmingham", state: "AL", latitude: 33.52, longitude: -86.80 },
  { city: "Boise", state: "ID", latitude: 43.62, longitude: -116.20 },
  { city: "Boston", state: "MA", latitude: 42.36, longitude: -71.06 },
  { city: "Boulder", state: "CO", latitude: 40.01, longitude: -105.27 },
  { city: "Brooklyn", state: "NY", latitude: 40.68, longitude: -73.94 },
  { city: "Buffalo", state: "NY", latitude: 42.89, longitude: -78.88 },
  { city: "Burlington", state: "VT", latitude: 44.48, longitude: -73.21 },
  { city: "Cambridge", state: "MA", latitude: 42.37, longitude: -71.11 },
  { city: "Chapel Hill", state: "NC", latitude: 35.91, longitude: -79.06 },
  { city: "Charleston", state: "SC", latitude: 32.78, longitude: -79.93 },
  { city: "Charlotte", state: "NC", latitude: 35.23, longitude: -80.84 },
  { city: "Chicago", state: "IL", latitude: 41.88, longitude: -87.63 },
  { city: "Cincinnati", state: "OH", latitude: 39.10, longitude: -84.51 },
  { city: "Cleveland", state: "OH", latitude: 41.50, longitude: -81.69 },
  { city: "Columbus", state: "OH", latitude: 39.96, longitude: -83.00 },
  { city: "Dallas", state: "TX", latitude: 32.78, longitude: -96.80 },
  { city: "Denver", state: "CO", latitude: 39.74, longitude: -104.99 },
  { city: "Detroit", state: "MI", latitude: 42.33, longitude: -83.05 },
  { city: "Eugene", state: "OR", latitude: 44.05, longitude: -123.09 },
  { city: "Fort Lauderdale", state: "FL", latitude: 26.12, longitude: -80.14 },
  { city: "Fort Worth", state: "TX", latitude: 32.76, longitude: -97.33 },
  { city: "Grand Rapids", state: "MI", latitude: 42.96, longitude: -85.67 },
  { city: "Houston", state: "TX", latitude: 29.76, longitude: -95.37 },
  { city: "Indianapolis", state: "IN", latitude: 39.77, longitude: -86.16 },
  { city: "Irvine", state: "CA", latitude: 33.68, longitude: -117.83 },
  { city: "Kansas City", state: "MO", latitude: 39.10, longitude: -94.58 },
  { city: "Las Vegas", state: "NV", latitude: 36.17, longitude: -115.14 },
  { city: "Long Beach", state: "CA", latitude: 33.77, longitude: -118.19 },
  { city: "Los Angeles", state: "CA", latitude: 34.05, longitude: -118.24 },
  { city: "Louisville", state: "KY", latitude: 38.25, longitude: -85.76 },
  { city: "Madison", state: "WI", latitude: 43.07, longitude: -89.40 },
  { city: "Memphis", state: "TN", latitude: 35.15, longitude: -90.05 },
  { city: "Miami", state: "FL", latitude: 25.76, longitude: -80.19 },
  { city: "Milwaukee", state: "WI", latitude: 43.04, longitude: -87.91 },
  { city: "Minneapolis", state: "MN", latitude: 44.98, longitude: -93.27 },
  { city: "Nashville", state: "TN", latitude: 36.16, longitude: -86.78 },
  { city: "New Haven", state: "CT", latitude: 41.31, longitude: -72.92 },
  { city: "New Orleans", state: "LA", latitude: 29.95, longitude: -90.07 },
  { city: "New York", state: "NY", latitude: 40.71, longitude: -74.01 },
  { city: "Oakland", state: "CA", latitude: 37.80, longitude: -122.27 },
  { city: "Oklahoma City", state: "OK", latitude: 35.47, longitude: -97.52 },
  { city: "Omaha", state: "NE", latitude: 41.26, longitude: -95.93 },
  { city: "Orlando", state: "FL", latitude: 28.54, longitude: -81.38 },
  { city: "Philadelphia", state: "PA", latitude: 39.95, longitude: -75.17 },
  { city: "Phoenix", state: "AZ", latitude: 33.45, longitude: -112.07 },
  { city: "Pittsburgh", state: "PA", latitude: 40.44, longitude: -80.00 },
  { city: "Portland", state: "OR", latitude: 45.52, longitude: -122.68 },
  { city: "Providence", state: "RI", latitude: 41.82, longitude: -71.41 },
  { city: "Raleigh", state: "NC", latitude: 35.78, longitude: -78.64 },
  { city: "Red Bank", state: "NJ", latitude: 40.35, longitude: -74.06 },
  { city: "Richmond", state: "VA", latitude: 37.54, longitude: -77.44 },
  { city: "Riverside", state: "CA", latitude: 33.98, longitude: -117.38 },
  { city: "Sacramento", state: "CA", latitude: 38.58, longitude: -121.49 },
  { city: "Salt Lake City", state: "UT", latitude: 40.76, longitude: -111.89 },
  { city: "San Antonio", state: "TX", latitude: 29.42, longitude: -98.49 },
  { city: "San Diego", state: "CA", latitude: 32.72, longitude: -117.16 },
  { city: "San Francisco", state: "CA", latitude: 37.77, longitude: -122.42 },
  { city: "San Jose", state: "CA", latitude: 37.34, longitude: -121.89 },
  { city: "Santa Ana", state: "CA", latitude: 33.75, longitude: -117.87 },
  { city: "Santa Barbara", state: "CA", latitude: 34.42, longitude: -119.70 },
  { city: "Santa Cruz", state: "CA", latitude: 36.97, longitude: -122.03 },
  { city: "Seattle", state: "WA", latitude: 47.61, longitude: -122.33 },
  { city: "Somerville", state: "MA", latitude: 42.39, longitude: -71.10 },
  { city: "St. Louis", state: "MO", latitude: 38.63, longitude: -90.20 },
  { city: "St. Paul", state: "MN", latitude: 44.95, longitude: -93.09 },
  { city: "Tampa", state: "FL", latitude: 27.95, longitude: -82.46 },
  { city: "Tempe", state: "AZ", latitude: 33.43, longitude: -111.94 },
  { city: "Washington", state: "DC", latitude: 38.91, longitude: -77.04 },
];

const US_STATES: StateEntry[] = [
  { name: "Alabama", code: "AL" },
  { name: "Alaska", code: "AK" },
  { name: "Arizona", code: "AZ" },
  { name: "Arkansas", code: "AR" },
  { name: "California", code: "CA" },
  { name: "Colorado", code: "CO" },
  { name: "Connecticut", code: "CT" },
  { name: "Delaware", code: "DE" },
  { name: "District of Columbia", code: "DC" },
  { name: "Florida", code: "FL" },
  { name: "Georgia", code: "GA" },
  { name: "Hawaii", code: "HI" },
  { name: "Idaho", code: "ID" },
  { name: "Illinois", code: "IL" },
  { name: "Indiana", code: "IN" },
  { name: "Iowa", code: "IA" },
  { name: "Kansas", code: "KS" },
  { name: "Kentucky", code: "KY" },
  { name: "Louisiana", code: "LA" },
  { name: "Maine", code: "ME" },
  { name: "Maryland", code: "MD" },
  { name: "Massachusetts", code: "MA" },
  { name: "Michigan", code: "MI" },
  { name: "Minnesota", code: "MN" },
  { name: "Mississippi", code: "MS" },
  { name: "Missouri", code: "MO" },
  { name: "Montana", code: "MT" },
  { name: "Nebraska", code: "NE" },
  { name: "Nevada", code: "NV" },
  { name: "New Hampshire", code: "NH" },
  { name: "New Jersey", code: "NJ" },
  { name: "New Mexico", code: "NM" },
  { name: "New York", code: "NY" },
  { name: "North Carolina", code: "NC" },
  { name: "North Dakota", code: "ND" },
  { name: "Ohio", code: "OH" },
  { name: "Oklahoma", code: "OK" },
  { name: "Oregon", code: "OR" },
  { name: "Pennsylvania", code: "PA" },
  { name: "Rhode Island", code: "RI" },
  { name: "South Carolina", code: "SC" },
  { name: "South Dakota", code: "SD" },
  { name: "Tennessee", code: "TN" },
  { name: "Texas", code: "TX" },
  { name: "Utah", code: "UT" },
  { name: "Vermont", code: "VT" },
  { name: "Virginia", code: "VA" },
  { name: "Washington", code: "WA" },
  { name: "West Virginia", code: "WV" },
  { name: "Wisconsin", code: "WI" },
  { name: "Wyoming", code: "WY" },
];

export const US_CONCERT_MARKETS: LocationSuggestion[] =
  CONCERT_MARKETS.map(toCitySuggestion);

export const US_STATE_SUGGESTIONS: LocationSuggestion[] =
  US_STATES.map(toStateSuggestion);

const normalizeSearch = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");

export const searchConcertMarkets = (
  query: string,
  limit = 8,
): LocationSuggestion[] => {
  const normalized = normalizeSearch(query);
  if (!normalized) {
    return [];
  }

  const cityMatches = US_CONCERT_MARKETS.filter((market) => {
    const city = normalizeSearch(market.city);
    const label = normalizeSearch(market.label);
    const state = market.state.toLowerCase();

    return (
      city.startsWith(normalized) ||
      label.startsWith(normalized) ||
      state.startsWith(normalized)
    );
  });

  const stateMatches = US_STATE_SUGGESTIONS.filter((entry) => {
    const stateName = normalizeSearch(entry.label.replace(/\(entire state\)/i, ""));
    const code = entry.state.toLowerCase();

    return stateName.startsWith(normalized) || code === normalized;
  });

  return [...stateMatches, ...cityMatches].slice(0, limit);
};

/** Center point of a listed concert market, or null when the city isn't listed. */
export const marketCenter = (
  city: string | null | undefined,
  state: string | null | undefined,
): { latitude: number; longitude: number } | null => {
  if (!city) return null;
  const wantedCity = normalizeSearch(city);
  const wantedState = state?.trim().toUpperCase() || null;
  const market = CONCERT_MARKETS.find(
    (entry) =>
      normalizeSearch(entry.city) === wantedCity && (!wantedState || entry.state === wantedState),
  );
  return market ? { latitude: market.latitude, longitude: market.longitude } : null;
};
