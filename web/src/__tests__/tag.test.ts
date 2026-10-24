// U66: a filter chip with an "x" — the "x" is its own button and answers a tap (it never did under the chip's touch area).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Tag } from '../components/Tag';
import { activeFilters } from '../pages/worker/feed/feedUI';

describe('U66: removable filter chips', () => {
  it('renders the label and a separate button to take the filter off', () => {
    const html = renderToStaticMarkup(createElement(Tag, { label: 'Hoje', selected: true, onRemove: () => undefined }));
    expect(html).toContain('aria-label="Tirar o filtro Hoje"');
    // The chip itself is not a button (no button inside a button).
    expect(html.match(/<button/g)).toHaveLength(1);
  });

  it('a plain chip stays a toggle button', () => {
    const html = renderToStaticMarkup(createElement(Tag, { label: 'Hoje', selected: true, onClick: () => undefined }));
    expect(html).toContain('aria-pressed="true"');
  });

  it('U65: the minimum pay shows as a chip', () => {
    const chips = activeFilters(
      { location: 'São Paulo, SP', oficio: null, dist: 'Toda a cidade', quando: null, minPay: 200 },
      'São Paulo, SP'
    );
    expect(chips.map((c) => c.label)).toEqual(['A partir de R$ 200']);
  });
});
