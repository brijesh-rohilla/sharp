// LinkedIn Post Highlighter - popup feature

(function () {
  'use strict';

  // -- State -----------------------------------------------------------------
  let keywords = [];
  let matchCount = 0;
  let currentIndex = -1;

  // -- DOM refs ---------------------------------------------------------------
  const input = document.getElementById('kw-input');
  const btnAdd = document.getElementById('btn-add');
  const chipsEl = document.getElementById('chips-container');
  const noKwHint = document.getElementById('no-kw-hint');
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const statusSub = document.getElementById('status-sub');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const btnClear = document.getElementById('btn-clear');

  // -- Helpers ----------------------------------------------------------------
  function getActiveTab(cb) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => cb(tabs[0]));
  }

  function sendToContent(msg, cb) {
    getActiveTab((tab) => {
      if (!tab) return;
      chrome.tabs.sendMessage(tab.id, msg, (response) => {
        if (chrome.runtime.lastError) {
          // Content script not yet injected - try programmatic injection
          chrome.scripting.executeScript(
            {
              target: { tabId: tab.id },
              files: ['js/common.js', 'js/content/post-highlighter.js'],
            },
            () => chrome.tabs.sendMessage(tab.id, msg, cb),
          );
          return;
        }
        if (cb) cb(response);
      });
    });
  }

  // -- UI: chips --------------------------------------------------------------
  function renderChips() {
    // Remove existing chips (keep hint span in DOM for toggle)
    chipsEl.querySelectorAll('.chip').forEach((c) => c.remove());

    noKwHint.style.display = keywords.length ? 'none' : 'inline';

    keywords.forEach((kw, i) => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.innerHTML = `
        <span>${LPHCommon.sanitize(kw)}</span>
        <button class="chip-remove" data-index="${i}" title="Remove">×</button>
      `;
      chipsEl.appendChild(chip);
    });
  }

  // -- UI: status -------------------------------------------------------------
  function updateStatus() {
    if (matchCount === 0) {
      statusDot.classList.remove('active');
      statusText.textContent = keywords.length ? 'No matches found' : 'No keywords set';
      statusSub.textContent = '';
    } else {
      statusDot.classList.add('active');
      statusText.textContent = `${matchCount} post${matchCount !== 1 ? 's' : ''} matched`;
      statusSub.textContent = currentIndex >= 0 ? `${currentIndex + 1} / ${matchCount}` : '';
    }

    btnPrev.disabled = matchCount < 1;
    btnNext.disabled = matchCount < 1;
  }

  // -- Keyword management -----------------------------------------------------
  function addKeyword() {
    const val = input.value.trim();
    if (!val || keywords.includes(val)) {
      input.value = '';
      return;
    }

    keywords.push(val);
    input.value = '';
    saveAndApply();
  }

  function removeKeyword(index) {
    keywords.splice(index, 1);
    saveAndApply();
  }

  function saveAndApply() {
    chrome.storage.local.set({ lph_keywords: keywords });
    renderChips();
    sendToContent({ type: 'SET_KEYWORDS', keywords }, (res) => {
      if (res) {
        matchCount = res.matchCount ?? 0;
        currentIndex = res.currentIndex ?? -1;
      }
      updateStatus();
    });
  }

  // -- Navigation -------------------------------------------------------------
  function navigate(direction) {
    sendToContent({ type: 'NAVIGATE', direction }, (res) => {
      if (res) {
        matchCount = res.matchCount ?? 0;
        currentIndex = res.currentIndex ?? -1;
      }
      updateStatus();
    });
  }

  // -- Clear ------------------------------------------------------------------
  function clearAll() {
    keywords = [];
    matchCount = 0;
    currentIndex = -1;
    chrome.storage.local.set({ lph_keywords: [] });
    renderChips();
    updateStatus();
    sendToContent({ type: 'CLEAR' });
  }

  // -- State sync from content ------------------------------------------------
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'STATE_UPDATE') {
      matchCount = msg.matchCount ?? 0;
      currentIndex = msg.currentIndex ?? -1;
      updateStatus();
    }
  });

  // -- Event listeners --------------------------------------------------------
  btnAdd.addEventListener('click', addKeyword);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addKeyword();
    if (e.key === 'Backspace' && !input.value && keywords.length) {
      removeKeyword(keywords.length - 1);
    }
  });

  chipsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip-remove');
    if (btn) removeKeyword(parseInt(btn.dataset.index, 10));
  });

  btnPrev.addEventListener('click', () => navigate('prev'));
  btnNext.addEventListener('click', () => navigate('next'));
  btnClear.addEventListener('click', clearAll);

  // -- Keyboard shortcuts in popup -------------------------------------------
  document.addEventListener('keydown', (e) => {
    if (document.activeElement === input) return;
    if (e.key === 'ArrowRight' || e.key === 'n') navigate('next');
    if (e.key === 'ArrowLeft' || e.key === 'p') navigate('prev');
  });

  // -- Init: load saved keywords & sync state --------------------------------
  chrome.storage.local.get(['lph_keywords'], (result) => {
    keywords = result.lph_keywords || [];
    renderChips();

    sendToContent({ type: 'GET_STATE' }, (res) => {
      if (res) {
        matchCount = res.matchCount ?? 0;
        currentIndex = res.currentIndex ?? -1;
        // If keywords differ from stored (e.g. fresh page load), re-apply
        if (keywords.length && res.keywords?.length !== keywords.length) {
          sendToContent({ type: 'SET_KEYWORDS', keywords }, (res2) => {
            if (res2) {
              matchCount = res2.matchCount ?? 0;
              currentIndex = res2.currentIndex ?? -1;
            }
            updateStatus();
          });
          return;
        }
      }
      updateStatus();
    });
  });
})();
