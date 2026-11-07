'use strict';
// Which lines of a county's sales table are this home changing hands at that price. A deed or a reason that moves title
// without selling the home isn't a sale: an easement, a quit claim, a gift, part of an interest, a boundary change, timber,
// a transfer inside a company, a correction. A real sale stays a sale however it came about: an estate, a family, a foreclosure, a new
// house, several parcels sold together (as for Clark, #3592).

const NOT_A_SALE = /QUIT ?-?CLAIM|\bQCD?\b|EASEMENT|RIGHT[- ]OF[- ]WAY|\bR\/W\b|\bGIFT|LOVE ?(AND|&) ?AFFECTION|PARTIAL INT|PART(IAL)? INTEREST|LESS THAN (A )?(FULL|100)|\d+ ?% INTEREST|PERCENT INTEREST|BOUNDARY|SEGREGATION|TIMBER|CORP(ORATE)? TRANSFER|WITHIN A CORPORATION|CORRECT|CORCT|DEED OF TRUST|\bMORTGAGE\b|\bLIEN\b|RELEASE|ORDER OF TAKING|CONDEMN|NO REAL PROPERTY/i;

// Below this a line is a recording fee or a token, whatever its deed says.
const TOKEN_PRICE = 1000;

/** Every word a county says about a line (its deed type, its reason), and its price. */
function isHomeSale(price, ...words) {
  return Number(price) > TOKEN_PRICE && !words.some((text) => NOT_A_SALE.test(String(text ?? '')));
}

module.exports = { isHomeSale, TOKEN_PRICE };
