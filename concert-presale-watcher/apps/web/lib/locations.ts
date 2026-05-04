import type { LocationSuggestion } from "./types";

type ConcertMarket = {
  city: string;
  state: string;
};

const toSuggestion = ({ city, state }: ConcertMarket): LocationSuggestion => ({
  id: `${city.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${state.toLowerCase()}`,
  city,
  state,
  country: "US",
  label: `${city}, ${state}`,
  description: "United States",
});

const CONCERT_MARKETS: ConcertMarket[] = [
  { city: "Albuquerque", state: "NM" },
  { city: "Anaheim", state: "CA" },
  { city: "Ann Arbor", state: "MI" },
  { city: "Asbury Park", state: "NJ" },
  { city: "Atlanta", state: "GA" },
  { city: "Austin", state: "TX" },
  { city: "Baltimore", state: "MD" },
  { city: "Berkeley", state: "CA" },
  { city: "Birmingham", state: "AL" },
  { city: "Boise", state: "ID" },
  { city: "Boston", state: "MA" },
  { city: "Boulder", state: "CO" },
  { city: "Brooklyn", state: "NY" },
  { city: "Buffalo", state: "NY" },
  { city: "Burlington", state: "VT" },
  { city: "Cambridge", state: "MA" },
  { city: "Chapel Hill", state: "NC" },
  { city: "Charleston", state: "SC" },
  { city: "Charlotte", state: "NC" },
  { city: "Chicago", state: "IL" },
  { city: "Cincinnati", state: "OH" },
  { city: "Cleveland", state: "OH" },
  { city: "Columbus", state: "OH" },
  { city: "Dallas", state: "TX" },
  { city: "Denver", state: "CO" },
  { city: "Detroit", state: "MI" },
  { city: "Eugene", state: "OR" },
  { city: "Fort Lauderdale", state: "FL" },
  { city: "Fort Worth", state: "TX" },
  { city: "Grand Rapids", state: "MI" },
  { city: "Houston", state: "TX" },
  { city: "Indianapolis", state: "IN" },
  { city: "Irvine", state: "CA" },
  { city: "Kansas City", state: "MO" },
  { city: "Las Vegas", state: "NV" },
  { city: "Long Beach", state: "CA" },
  { city: "Los Angeles", state: "CA" },
  { city: "Louisville", state: "KY" },
  { city: "Madison", state: "WI" },
  { city: "Memphis", state: "TN" },
  { city: "Miami", state: "FL" },
  { city: "Milwaukee", state: "WI" },
  { city: "Minneapolis", state: "MN" },
  { city: "Nashville", state: "TN" },
  { city: "New Haven", state: "CT" },
  { city: "New Orleans", state: "LA" },
  { city: "New York", state: "NY" },
  { city: "Oakland", state: "CA" },
  { city: "Oklahoma City", state: "OK" },
  { city: "Omaha", state: "NE" },
  { city: "Orlando", state: "FL" },
  { city: "Philadelphia", state: "PA" },
  { city: "Phoenix", state: "AZ" },
  { city: "Pittsburgh", state: "PA" },
  { city: "Portland", state: "OR" },
  { city: "Providence", state: "RI" },
  { city: "Raleigh", state: "NC" },
  { city: "Red Bank", state: "NJ" },
  { city: "Richmond", state: "VA" },
  { city: "Riverside", state: "CA" },
  { city: "Sacramento", state: "CA" },
  { city: "Salt Lake City", state: "UT" },
  { city: "San Antonio", state: "TX" },
  { city: "San Diego", state: "CA" },
  { city: "San Francisco", state: "CA" },
  { city: "San Jose", state: "CA" },
  { city: "Santa Ana", state: "CA" },
  { city: "Santa Barbara", state: "CA" },
  { city: "Santa Cruz", state: "CA" },
  { city: "Seattle", state: "WA" },
  { city: "Somerville", state: "MA" },
  { city: "St. Louis", state: "MO" },
  { city: "St. Paul", state: "MN" },
  { city: "Tampa", state: "FL" },
  { city: "Tempe", state: "AZ" },
  { city: "Washington", state: "DC" },
];

export const US_CONCERT_MARKETS: LocationSuggestion[] =
  CONCERT_MARKETS.map(toSuggestion);

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

  return US_CONCERT_MARKETS.filter((market) => {
    const city = normalizeSearch(market.city);
    const label = normalizeSearch(market.label);
    const state = market.state.toLowerCase();

    return (
      city.startsWith(normalized) ||
      label.startsWith(normalized) ||
      state.startsWith(normalized)
    );
  }).slice(0, limit);
};
