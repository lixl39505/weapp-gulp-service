"use strict";

var _getRegexpMatches = require("./getRegexpMatches");

const text = 'a ab abc abcd';
describe('getRegexpMatches', () => {
  it('returns an empty array if string contains no matches', () => {
    expect((0, _getRegexpMatches.getRegexpMatches)(/foo/, text)).toEqual([]);
  });
  it('returns an array with the single match if used with a RegExp without `g` flag', () => {
    const regexp = /ab(c)?/;
    expect((0, _getRegexpMatches.getRegexpMatches)(regexp, text)).toEqual([regexp.exec(text)]);
  });
  it('finds all matches for a RegExp with `g` flag', () => {
    const regexp = /ab(c)?/g;
    expect((0, _getRegexpMatches.getRegexpMatches)(regexp, text)).toEqual([0, 1, 2].map(() => regexp.exec(text)));
  });
});