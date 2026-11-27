// Feature F05: Client-side Same-Category Comparison Tray (Catalog & Product Dossier Integration)
(function () {
  var STORAGE_KEY = 'truelabel_compare_queue';
  var MAX_ITEMS = 3;
  var warningTimer = null;

  function loadQueue() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (item) {
        return item && Number.isInteger(Number(item.id)) && Number(item.id) > 0 && item.name;
      });
    } catch (e) {
      return [];
    }
  }

  function saveQueue(queue) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (e) {}
  }

  function clearQueue() {
    saveQueue([]);
  }

  function syncQueueFromComparePage() {
    if (!window.location.pathname.startsWith('/catalog/compare')) return;

    var slotEls = document.querySelectorAll('[data-compare-slot]');
    if (slotEls.length > 0) {
      var synced = [];
      slotEls.forEach(function (el) {
        var id = Number(el.getAttribute('data-product-id'));
        if (id > 0) {
          synced.push({
            id: id,
            name: el.getAttribute('data-product-name') || 'Product #' + id,
            brand: el.getAttribute('data-product-brand') || '',
            category: el.getAttribute('data-product-category') || '',
            score: Number(el.getAttribute('data-product-score') || 0),
          });
        }
      });
      saveQueue(synced.slice(0, MAX_ITEMS));
      return;
    }

    var params = new URLSearchParams(window.location.search);
    if (!params.get('ids')) {
      clearQueue();
    }
  }

  function ensureTrayElement() {
    var existing = document.getElementById('truelabel-compare-tray');
    if (existing) return existing;

    var tray = document.createElement('aside');
    tray.id = 'truelabel-compare-tray';
    tray.setAttribute('aria-live', 'polite');
    tray.className =
      'hidden fixed top-[72px] right-3 left-3 sm:left-auto sm:right-5 sm:w-[400px] z-[55] rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xl p-3.5 text-xs';
    document.body.appendChild(tray);
    return tray;
  }

  function showWarningBanner(message) {
    var tray = ensureTrayElement();
    renderTray(message);
    if (warningTimer) clearTimeout(warningTimer);
    warningTimer = setTimeout(function () {
      renderTray(null);
    }, 5000);
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  function updateToggleButtons() {
    var queue = loadQueue();
    var selectedIds = queue.map(function (q) {
      return Number(q.id);
    });
    var activeCategory = queue.length > 0 ? String(queue[0].category || '').toLowerCase() : null;

    document.querySelectorAll('[data-compare-toggle]').forEach(function (btn) {
      var id = Number(btn.getAttribute('data-product-id'));
      var cat = String(btn.getAttribute('data-product-category') || '').toLowerCase();
      var isSelected = selectedIds.indexOf(id) !== -1;
      var labelEl = btn.querySelector('[data-compare-label]');

      btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');

      if (isSelected) {
        btn.classList.remove(
          'border-slate-300',
          'dark:border-slate-700',
          'text-slate-700',
          'dark:text-slate-300',
          'bg-white',
          'dark:bg-slate-800',
        );
        btn.classList.add(
          'border-emerald-600',
          'bg-emerald-700',
          'text-white',
          'dark:bg-emerald-600',
        );
        if (labelEl) labelEl.textContent = 'Added to compare';
      } else {
        btn.classList.remove(
          'border-emerald-600',
          'bg-emerald-700',
          'text-white',
          'dark:bg-emerald-600',
        );
        btn.classList.add(
          'border-slate-300',
          'dark:border-slate-700',
          'text-slate-700',
          'dark:text-slate-300',
          'bg-white',
          'dark:bg-slate-800',
        );

        if (activeCategory && cat && cat !== activeCategory) {
          btn.setAttribute('title', 'Different category from currently queued comparison');
          if (labelEl) labelEl.textContent = '+ Compare';
        } else {
          btn.removeAttribute('title');
          if (labelEl) labelEl.textContent = '+ Compare';
        }
      }
    });
  }

  function renderTray(warningMessage) {
    if (window.location.pathname.startsWith('/catalog/compare')) return;

    var tray = ensureTrayElement();
    var queue = loadQueue();

    if (queue.length === 0 && !warningMessage) {
      tray.classList.add('hidden');
      tray.innerHTML = '';
      return;
    }

    tray.classList.remove('hidden');

    var idsParam = queue
      .map(function (item) {
        return item.id;
      })
      .join(',');
    var compareHref = idsParam ? '/catalog/compare?ids=' + encodeURIComponent(idsParam) : '/catalog/compare';
    var categoryLabel = queue.length > 0 ? queue[0].category : '';

    var itemsHtml = queue
      .map(function (item) {
        return (
          '<div class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">' +
          '<div class="min-w-0">' +
          '<div class="font-bold text-slate-900 dark:text-slate-100 truncate">' +
          escapeHtml(item.name) +
          '</div>' +
          '<div class="text-[10px] text-slate-500 dark:text-slate-400 truncate">' +
          escapeHtml(item.brand) +
          '</div>' +
          '</div>' +
          '<button type="button" data-tray-remove="' +
          item.id +
          '" class="min-h-[32px] min-w-[32px] px-2 rounded text-[11px] font-semibold text-slate-500 hover:text-rose-700 dark:hover:text-rose-400" aria-label="Remove ' +
          escapeHtml(item.name) +
          '">&times;</button>' +
          '</div>'
        );
      })
      .join('');

    var warningHtml = warningMessage
      ? '<div class="mb-2.5 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-[11px] font-medium">' +
        escapeHtml(warningMessage) +
        '</div>'
      : '';

    var ctaLabel =
      queue.length >= 2
        ? 'Compare foods (' + queue.length + ')'
        : 'Add 1 more or open bench';

    tray.innerHTML =
      warningHtml +
      '<div class="flex items-center justify-between gap-2 mb-2">' +
      '<div>' +
      '<span class="font-bold text-slate-900 dark:text-white">Compare queue (' +
      queue.length +
      '/3)</span>' +
      (categoryLabel
        ? '<span class="ml-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">' +
          escapeHtml(categoryLabel) +
          '</span>'
        : '') +
      '</div>' +
      '<button type="button" id="truelabel-compare-clear-btn" class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-400 px-1.5 py-1">Clear</button>' +
      '</div>' +
      '<div class="space-y-1.5 mb-2.5">' +
      itemsHtml +
      '</div>' +
      '<div class="flex items-center gap-2">' +
      '<a href="' +
      compareHref +
      '" class="flex-1 min-h-[40px] inline-flex items-center justify-center px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-semibold transition-colors">' +
      escapeHtml(ctaLabel) +
      '</a>' +
      '</div>';

    tray.querySelectorAll('[data-tray-remove]').forEach(function (removeBtn) {
      removeBtn.addEventListener('click', function () {
        var targetId = Number(removeBtn.getAttribute('data-tray-remove'));
        var next = loadQueue().filter(function (q) {
          return Number(q.id) !== targetId;
        });
        saveQueue(next);
        updateToggleButtons();
        renderTray(null);
      });
    });

    var clearBtn = document.getElementById('truelabel-compare-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        clearQueue();
        updateToggleButtons();
        renderTray(null);
      });
    }
  }

  function handleToggleClick(btn) {
    var id = Number(btn.getAttribute('data-product-id'));
    if (!id) return;

    var item = {
      id: id,
      name: btn.getAttribute('data-product-name') || 'Product #' + id,
      brand: btn.getAttribute('data-product-brand') || '',
      category: btn.getAttribute('data-product-category') || '',
      score: Number(btn.getAttribute('data-product-score') || 0),
    };

    var queue = loadQueue();
    var existingIndex = queue.findIndex(function (q) {
      return Number(q.id) === id;
    });

    if (existingIndex !== -1) {
      queue.splice(existingIndex, 1);
      saveQueue(queue);
      updateToggleButtons();
      renderTray(null);
      return;
    }

    if (
      queue.length > 0 &&
      String(queue[0].category || '').trim().toLowerCase() !==
        String(item.category || '').trim().toLowerCase()
    ) {
      showWarningBanner(
        'Cross-category comparison blocked: queued items are in "' +
          queue[0].category +
          '". Clear the queue first to compare "' +
          item.category +
          '".',
      );
      return;
    }

    if (queue.length >= MAX_ITEMS) {
      showWarningBanner(
        'Maximum 3 foods can be compared together. Remove one item from the tray to swap.',
      );
      return;
    }

    queue.push(item);
    saveQueue(queue);
    updateToggleButtons();
    renderTray(null);
  }

  document.addEventListener('DOMContentLoaded', function () {
    syncQueueFromComparePage();

    document.querySelectorAll('[data-compare-clear]').forEach(function (el) {
      el.addEventListener('click', function () {
        clearQueue();
      });
    });

    document.querySelectorAll('[data-compare-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        handleToggleClick(btn);
      });
    });

    updateToggleButtons();
    renderTray(null);
  });
})();
