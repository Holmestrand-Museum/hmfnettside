export function plainText(markdown = '') {
  return markdown
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[#*_`~>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const normalize = (text) => text.normalize('NFC').toLocaleLowerCase('nb');

export function searchArticles(articles, query) {
  const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return articles.map((article) => {
    const title = normalize(article.title);
    const tags = normalize(article.tags.join(' '));
    const text = normalize(article.text);
    const score = terms.reduce((sum, term) => {
      const points = title.includes(term) ? 10 : tags.includes(term) ? 5 : text.includes(term) ? 1 : 0;
      return !points || sum < 0 ? -1 : sum + points;
    }, 0);
    const match = terms.map((term) => text.indexOf(term)).filter((index) => index >= 0);
    let start = match.length ? Math.max(0, Math.min(...match) - 65) : 0;
    if (start > 0) start = article.text.lastIndexOf(' ', start) + 1;
    const end = start + 220;
    const snippet = `${start ? '…' : ''}${article.text.slice(start, end)}${end < article.text.length ? '…' : ''}`;
    return { ...article, score, snippet };
  }).filter((article) => article.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'nb'));
}
