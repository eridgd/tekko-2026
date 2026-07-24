import { describe, expect, it } from 'vitest';
import { classify, decodeEntities, CATEGORIES } from './categories.mjs';

const s = (tags, title = 'Some Event') => ({ tags, title });

describe('decodeEntities', () => {
  it('unescapes what Eventeny double-encodes', () => {
    expect(decodeEntities('RPG 1&amp;2')).toBe('RPG 1&2');
    expect(decodeEntities('Charles &quot;Lex&quot; Dunbar')).toBe('Charles "Lex" Dunbar');
    expect(decodeEntities('Pennsylvania&#039;s largest')).toBe("Pennsylvania's largest");
  });
});

describe('classify', () => {
  it('maps an explicit category tag', () => {
    expect(classify(s('Tekko|Panel'), 'Panel 1 (303-305)').category).toBe('panel');
  });

  it('ignores the meaningless "Tekko" boilerplate tag', () => {
    // "Tekko" is on 86 sessions and tells you nothing.
    const r = classify(s('Tekko'), 'Rooftop Terrace');
    expect(r.category).toBe('other');
    expect(r.presenters).toEqual([]);
  });

  it('falls back to the track when tags carry no category', () => {
    const r = classify(s(''), 'Videos (335 & 334)');
    expect(r.category).toBe('screening');
    expect(r.viaTrack).toBe(true);
  });

  it('prefers an explicit tag over the track fallback', () => {
    const r = classify(s('Workshop'), 'Panel 7 Workshops (319)');
    expect(r.category).toBe('workshop');
    expect(r.viaTrack).toBe(false);
  });

  it('collects audience flags separately from the category', () => {
    const r = classify(s('Panel|18+|Featured Panelist(s)'), 'Panel 5 (317)');
    expect(r.category).toBe('panel');
    expect(r.flags.sort()).toEqual(['adult', 'featured']);
  });

  it('treats unknown tokens as presenter names', () => {
    const r = classify(s('Panel|Zeke Changuris|16+'), 'Panel 2 (306-307)');
    expect(r.category).toBe('panel');
    expect(r.presenters).toEqual(['Zeke Changuris']);
    expect(r.flags).toEqual(['teen']);
  });

  it('keeps interest topics out of the presenter list', () => {
    const r = classify(s('Panel|LGBTQ+|Some Person'), 'Panel 1 (303-305)');
    expect(r.topics).toEqual(['LGBTQ+']);
    expect(r.presenters).toEqual(['Some Person']);
  });

  it('infers 18+ from an R rating in a screening title', () => {
    // The video rooms encode ratings in the title, not in tags.
    const r = classify(s('Video', 'Hokuto no Ken (Sub) (R)'), 'Videos (335 & 334)');
    expect(r.flags).toContain('adult');
  });

  it('handles the empty-token artefact in pipe-delimited tags', () => {
    const r = classify(s('Tekko|Main Event||Rachel Ann Bovier'), 'Main Stage');
    expect(r.category).toBe('mainevent');
    expect(r.presenters).toEqual(['Rachel Ann Bovier']);
  });

  it('decodes entities before matching', () => {
    const r = classify(s('Chibi (12&amp;Under)'), 'Chibi Tekko 1 (325)');
    expect(r.flags).toContain('kids');
  });

  it('is case insensitive', () => {
    expect(classify(s('PANEL'), '').category).toBe('panel');
    expect(classify(s('workshop'), '').category).toBe('workshop');
  });

  it('never returns a category outside the declared list', () => {
    const ids = new Set(CATEGORIES.map((c) => c.id));
    for (const tags of ['', 'Panel', 'nonsense token', 'Video|18+']) {
      expect(ids.has(classify(s(tags), 'Some Room').category)).toBe(true);
    }
  });

  it('matches the most specific track rule first', () => {
    // "Panel 9 (323)" contains "panel"; "Cosplay Panel (406)" must not.
    expect(classify(s(''), 'Cosplay Panel (406)').category).toBe('cosplay');
    expect(classify(s(''), 'Panel 9 (323)').category).toBe('panel');
  });
});
