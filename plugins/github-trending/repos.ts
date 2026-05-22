/**
 * GitHub Trending — mirrors ByteYue/opencli-plugin-github-trending/repos.yaml
 * JS/TS adapter required because opencli 1.8.0 rejects pure-YAML plugin installs.
 */
import { cli, Strategy } from '@jackwener/opencli/registry';

cli({
  site: 'github-trending',
  name: 'repos',
  description: 'GitHub Trending repositories',
  strategy: Strategy.PUBLIC,
  access: 'read',
  browser: true,
  domain: 'github.com',
  args: [
    { name: 'language', type: 'string', default: '', help: 'Filter by language (e.g. python, rust)' },
    { name: 'since', type: 'string', default: 'daily', choices: ['daily', 'weekly', 'monthly'], help: 'Time range' },
    { name: 'limit', type: 'int', default: 25, help: 'Max results' },
  ],
  columns: ['rank', 'name', 'language', 'stars', 'description'],
  pipeline: [
    {
      navigate: 'https://github.com/trending/${{ args.language }}?since=${{ args.since }}',
    },
    {
      evaluate: `(() => {
        return [...document.querySelectorAll('article.Box-row')].map((el, i) => {
          const name = el.querySelector('h2 a')?.getAttribute('href')?.slice(1) || '';
          return {
            rank: i + 1,
            name,
            description: el.querySelector('p')?.textContent?.trim() || '',
            language: el.querySelector('[itemprop=programmingLanguage]')?.textContent?.trim() || '',
            stars: el.querySelector('.Link--muted.d-inline-block.mr-3')?.textContent?.trim() || '0',
            url: 'https://github.com/' + name,
          };
        });
      })()`,
    },
    { limit: '${{ args.limit }}' },
  ],
});
