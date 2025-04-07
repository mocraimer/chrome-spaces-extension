import { Space } from '@/shared/types/Space';

/**
 * Score a string based on how well it matches a search query
 */
const getMatchScore = (text: string, query: string): number => {
  text = text.toLowerCase();
  query = query.toLowerCase();

  // Exact match gets highest score
  if (text === query) return 1;

  // Starts with query gets second highest score
  if (text.startsWith(query)) return 0.8;

  // Contains query as word gets third highest score
  if (text.includes(` ${query} `) || text.endsWith(` ${query}`)) return 0.6;

  // Contains query gets lowest positive score
  if (text.includes(query)) return 0.4;

  // No match
  return 0;
};

/**
 * Filter and sort spaces based on search query
 */
export const searchSpaces = (spaces: Space[], query: string): Space[] => {
  if (!query.trim()) return spaces;

  return spaces
    .map(space => ({
      space,
      score: getMatchScore(space.name, query)
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)  // Sort by score descending
    .map(item => item.space);
};