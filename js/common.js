// LinkedIn Post Highlighter - shared helpers

(function (global) {
  'use strict';

  const LPHCommon = {
    escapeRegex(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    buildPattern(kws) {
      if (!kws.length) return null;
      const parts = kws.map(LPHCommon.escapeRegex);
      return new RegExp(`(${parts.join('|')})`, 'gi');
    },

    normalizeKeywords(kws) {
      return (kws || []).map((k) => k.trim()).filter(Boolean);
    },

    sanitize(str) {
      return str.replace(
        /[<>&"]/g,
        (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c],
      );
    },
  };

  global.LPHCommon = LPHCommon;
})(typeof window !== 'undefined' ? window : self);
