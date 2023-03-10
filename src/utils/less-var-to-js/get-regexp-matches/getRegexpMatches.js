"use strict";

require("core-js/modules/esnext.array.last-index");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getRegexpMatches = getRegexpMatches;

function getRegexpMatches(regexp, text) {
  const matches = [];
  const lastIndex = regexp.lastIndex;
  let match;

  do {
    match = regexp.exec(text);

    if (match) {
      matches.push(match);
    } // prevent infinite loop (only regular expressions with `global` flag retain the `lastIndex`)

  } while (match && regexp.global); // don't leak `lastIndex` changes


  regexp.lastIndex = lastIndex;
  return matches;
}