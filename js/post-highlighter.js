// LinkedIn Post Highlighter - content feature
// Robust against LinkedIn's dynamic DOM, supports infinite scroll

(function () {
  'use strict';

  // -- State -----------------------------------------------------------------
  let keywords = [];
  let highlightedPosts = []; // Array of post root elements that matched
  let currentIndex = -1;
  let observer = null;
  let pendingHighlight = null; // debounce timer

  // -- Post selectors (LinkedIn uses multiple layouts) -----------------------
  const POST_SELECTORS = [
    'div.feed-shared-update-v2',
    'div[data-urn*="activity"]',
    'div.occludable-update',
    'li.profile-creator-shared-feed-update__container',
  ].join(',');

  // Text content containers within a post
  const TEXT_SELECTORS = [
    '.feed-shared-text',
    '.feed-shared-inline-show-more-text',
    '.update-components-text',
    '.feed-shared-update-v2__description',
    '.attributed-text-segment-list__content',
    'span[dir]',
  ].join(',');

  // -- Utilities --------------------------------------------------------------
  // Walk text nodes only - don't clobber child elements
  function highlightTextNode(textNode, pattern) {
    const text = textNode.nodeValue;
    if (!pattern.test(text)) return false;
    pattern.lastIndex = 0;

    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    let match;

    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      // Text before match
      if (match.index > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }
      // Highlighted match
      const mark = document.createElement('mark');
      mark.className = 'lph-mark';
      mark.textContent = match[0];
      frag.appendChild(mark);
      lastIndex = pattern.lastIndex;
    }
    // Remaining text
    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    textNode.parentNode.replaceChild(frag, textNode);
    return true;
  }

  function walkAndHighlight(root, pattern) {
    // Skip if already highlighted or is a mark element
    if (!root || root.classList?.contains('lph-processed')) return 0;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        // Skip script/style/mark
        const tag = parent.tagName?.toLowerCase();
        if (['script', 'style', 'mark'].includes(tag)) return NodeFilter.FILTER_REJECT;
        // Skip already-highlighted marks
        if (parent.classList?.contains('lph-mark')) return NodeFilter.FILTER_REJECT;
        return node.nodeValue?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });

    const textNodes = [];
    let n;
    while ((n = walker.nextNode())) textNodes.push(n);

    let matched = 0;
    for (const tn of textNodes) {
      if (highlightTextNode(tn, pattern)) matched++;
    }
    return matched;
  }

  // Remove all <mark class="lph-mark"> and restore text
  function removeHighlights(root) {
    const marks = (root || document).querySelectorAll('mark.lph-mark');
    marks.forEach((mark) => {
      const parent = mark.parentNode;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    });
  }

  // -- Core highlight pass ----------------------------------------------------
  function highlightAll() {
    // Clear previous highlights
    removeHighlights(document.body);
    highlightedPosts = [];
    currentIndex = -1;

    if (!keywords.length) {
      notifyPopup({ matchCount: 0, currentIndex: -1 });
      return;
    }

    const pattern = LPHCommon.buildPattern(keywords);
    if (!pattern) return;

    const posts = document.querySelectorAll(POST_SELECTORS);

    posts.forEach((post) => {
      // Mark as not yet processed so walkAndHighlight works
      post.classList.remove('lph-processed');

      // Find text containers within the post
      const textContainers = post.querySelectorAll(TEXT_SELECTORS);
      let matchCount = 0;

      if (textContainers.length) {
        textContainers.forEach((tc) => {
          matchCount += walkAndHighlight(tc, LPHCommon.buildPattern(keywords));
        });
      } else {
        // Fallback: scan the whole post
        matchCount = walkAndHighlight(post, LPHCommon.buildPattern(keywords));
      }

      post.classList.add('lph-processed');

      if (matchCount > 0) {
        post.classList.add('lph-matched');
        highlightedPosts.push(post);
      } else {
        post.classList.remove('lph-matched');
      }
    });

    if (highlightedPosts.length > 0) {
      currentIndex = 0;
      scrollToPost(0);
    }

    notifyPopup({ matchCount: highlightedPosts.length, currentIndex });
  }

  // Debounced highlight for infinite scroll mutations
  function scheduleHighlight(delay = 600) {
    clearTimeout(pendingHighlight);
    pendingHighlight = setTimeout(() => {
      highlightNewPosts();
    }, delay);
  }

  // Incremental highlight: only process posts not yet marked
  function highlightNewPosts() {
    if (!keywords.length) return;

    const posts = document.querySelectorAll(POST_SELECTORS);
    let changed = false;

    posts.forEach((post) => {
      if (post.classList.contains('lph-processed')) return;

      const textContainers = post.querySelectorAll(TEXT_SELECTORS);
      let matchCount = 0;

      if (textContainers.length) {
        textContainers.forEach((tc) => {
          matchCount += walkAndHighlight(tc, LPHCommon.buildPattern(keywords));
        });
      } else {
        matchCount = walkAndHighlight(post, LPHCommon.buildPattern(keywords));
      }

      post.classList.add('lph-processed');

      if (matchCount > 0) {
        post.classList.add('lph-matched');
        if (!highlightedPosts.includes(post)) {
          highlightedPosts.push(post);
          changed = true;
        }
      }
    });

    if (changed) {
      if (currentIndex === -1 && highlightedPosts.length > 0) currentIndex = 0;
      notifyPopup({ matchCount: highlightedPosts.length, currentIndex });
    }
  }

  // -- Navigation -------------------------------------------------------------
  function scrollToPost(index) {
    if (!highlightedPosts.length) return;
    index = Math.max(0, Math.min(index, highlightedPosts.length - 1));
    currentIndex = index;

    // Remove active class from all
    highlightedPosts.forEach((p) => p.classList.remove('lph-active'));

    const post = highlightedPosts[currentIndex];
    post.classList.add('lph-active');

    post.scrollIntoView({ behavior: 'smooth', block: 'center' });
    notifyPopup({ matchCount: highlightedPosts.length, currentIndex });
  }

  function navigateNext() {
    if (!highlightedPosts.length) return;
    const next = (currentIndex + 1) % highlightedPosts.length;
    scrollToPost(next);
  }

  function navigatePrev() {
    if (!highlightedPosts.length) return;
    const prev = (currentIndex - 1 + highlightedPosts.length) % highlightedPosts.length;
    scrollToPost(prev);
  }

  // -- Notify popup of current state -----------------------------------------
  function notifyPopup(data) {
    chrome.runtime.sendMessage({ type: 'STATE_UPDATE', ...data }).catch(() => {});
  }

  // -- Inject styles ----------------------------------------------------------
  function injectStyles() {
    if (document.getElementById('lph-content-style')) return;

    const link = document.createElement('link');
    link.id = 'lph-content-style';
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('css/post-highlighter.css');

    (document.head || document.documentElement).appendChild(link);
  }

  // -- MutationObserver for infinite scroll ----------------------------------
  function startObserver() {
    if (observer) observer.disconnect();

    // Watch the main feed container
    const feedContainer =
      document.querySelector('main') ||
      document.querySelector('.scaffold-finite-scroll__content') ||
      document.body;

    observer = new MutationObserver((mutations) => {
      let hasNewNodes = false;
      for (const m of mutations) {
        if (m.addedNodes.length) {
          hasNewNodes = true;
          break;
        }
      }
      if (hasNewNodes) scheduleHighlight();
    });

    observer.observe(feedContainer, { childList: true, subtree: true });
  }

  // -- Message listener from popup -------------------------------------------
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg.type) {
      case 'SET_KEYWORDS':
        keywords = LPHCommon.normalizeKeywords(msg.keywords);
        highlightAll();
        sendResponse({ ok: true });
        break;

      case 'NAVIGATE':
        if (msg.direction === 'next') navigateNext();
        else navigatePrev();
        sendResponse({ matchCount: highlightedPosts.length, currentIndex });
        break;

      case 'GET_STATE':
        sendResponse({ matchCount: highlightedPosts.length, currentIndex, keywords });
        break;

      case 'CLEAR':
        keywords = [];
        removeHighlights(document.body);
        highlightedPosts = [];
        currentIndex = -1;
        document
          .querySelectorAll('.lph-matched, .lph-active, .lph-processed')
          .forEach((el) => el.classList.remove('lph-matched', 'lph-active', 'lph-processed'));
        sendResponse({ ok: true });
        break;
    }
    return true; // keep channel open for async
  });

  // -- Init -------------------------------------------------------------------
  injectStyles();
  startObserver();

  // Restore keywords from storage on page load
  chrome.storage.local.get(['lph_keywords'], (result) => {
    if (result.lph_keywords?.length) {
      keywords = result.lph_keywords;
      highlightAll();
    }
  });
})();
