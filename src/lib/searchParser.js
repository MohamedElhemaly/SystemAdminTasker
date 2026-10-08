export function parseSearchQuery(input) {
  if (!input) {
    return { text: '', tags: [], users: [], dates: [] };
  }

  const result = {
    text: input,
    tags: [],
    users: [],
    dates: []
  };

  // Regular expressions to match prefixes (supporting Arabic/Unicode via [^\s]+)
  const tagRegex = /(?:^|\s)#([^\s]+)/g;
  const userRegex = /(?:^|\s)@([^\s]+)/g;
  const dateRegex = /(?:^|\s):([^\s]+)/g;

  let match;

  while ((match = tagRegex.exec(input)) !== null) {
    result.tags.push(match[1]);
  }
  while ((match = userRegex.exec(input)) !== null) {
    result.users.push(match[1]);
  }
  while ((match = dateRegex.exec(input)) !== null) {
    result.dates.push(match[1]);
  }

  // Remove the matched prefixes from the text to leave only general search terms
  result.text = input
    .replace(/(?:^|\s)[#@:][^\s]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return result;
}
