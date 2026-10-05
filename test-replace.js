const expr2 = "close, barmerge.gaps_off, barmerge.lookahead_on";
console.log(expr2.replace(/,\s*(?:gaps\s*=\s*)?barmerge\.gaps_(?:on|off)|,\s*(?:lookahead\s*=\s*)?barmerge\.lookahead_(?:on|off)/g, ''));
