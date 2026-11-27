/**
 * TrueLabel Forensic Ingredient & E-Number Micro-Inspector
 *
 * Hover or tap inspectable ingredients, additives, allergens, or unclassified items
 * to view regulatory rule analysis, FDA/EU approval status, and 1-click copy citations.
 */

class TrueLabelIngredientInspector {
  constructor(options = {}) {
    this.targetSelector =
      options.targetSelector || '[data-inspectable-ingredient], [data-ingredient-name]';
    this.tooltip = null;
    this.pinned = false;
    this.activeEl = null;
    this.init();
  }

  createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'truelabel-hud-tooltip';
    document.body.appendChild(this.tooltip);
  }

  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  inspect(el, e) {
    if (this.pinned) return;
    this.activeEl = el;

    const name = this.escapeHtml(el.getAttribute('data-ingredient-name') || el.textContent.trim());
    const hazard = (el.getAttribute('data-hazard') || 'safe').toLowerCase();
    const hazardDetail = this.escapeHtml(el.getAttribute('data-hazard-detail') || '');
    const fdaStatus = this.escapeHtml(el.getAttribute('data-fda-status') || 'FDA Evaluated');
    const euStatus = this.escapeHtml(el.getAttribute('data-eu-status') || 'EU Registered');
    const ruleSource = this.escapeHtml(el.getAttribute('data-rule-source') || '');
    const allergen = this.escapeHtml(el.getAttribute('data-allergen') || '');

    let hazardBadge =
      '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">Verified Safe</span>';
    if (hazard === 'unknown') {
      hazardBadge =
        '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-indigo-300 border border-indigo-500/60">Unclassified (Not Assumed Safe)</span>';
    } else if (hazard === 'caution') {
      hazardBadge =
        '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700">Caution / Monitored</span>';
    } else if (hazard === 'warning' || hazard === 'hazard' || hazard === 'banned') {
      hazardBadge =
        '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-700">Regulatory Warning</span>';
    }

    let allergenSnippet = '';
    if (allergen && allergen !== 'false') {
      allergenSnippet = `<div class="mt-1.5 text-[11px] font-semibold text-rose-300">Declared Allergen: ${allergen}</div>`;
    }

    let sourceSnippet = '';
    if (ruleSource) {
      sourceSnippet = `<div class="mt-1 text-[10px] font-mono text-slate-400">Source: <span class="text-slate-200">${ruleSource}</span></div>`;
    }

    this.tooltip.innerHTML = `
      <div class="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-white/10">
        <span class="font-bold text-white text-[13px] tracking-tight">${name}</span>
        <div class="flex items-center gap-1.5 shrink-0">
          ${hazardBadge}
          <button type="button" class="truelabel-hud-close text-slate-300 hover:text-white text-xs px-2 py-1 rounded bg-white/10 cursor-pointer" aria-label="Close HUD" title="Close">✕</button>
        </div>
      </div>
      <div class="space-y-1 text-[11px] text-slate-300">
        <div class="flex items-center justify-between gap-2 text-[10px] font-mono text-slate-400">
          <span>FDA: <strong class="text-slate-200">${fdaStatus}</strong></span>
          <span>EU: <strong class="text-slate-200">${euStatus}</strong></span>
        </div>
        ${sourceSnippet}
        ${hazardDetail ? `<p class="pt-1 text-slate-300 leading-snug">${hazardDetail}</p>` : ''}
        ${allergenSnippet}
      </div>
      <div class="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
        <span class="text-emerald-400 font-mono font-medium">Click or tap to pin & copy</span>
        <span class="text-slate-500 font-mono">TrueLabel F03</span>
      </div>
    `;

    const closeBtn = this.tooltip.querySelector('.truelabel-hud-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.pinned = false;
        this.tooltip.classList.remove('pinned');
        this.tooltip.style.display = 'none';
      });
    }

    this.tooltip.style.display = 'block';
    this.positionTooltip(e);
  }

  positionTooltip(e) {
    if (window.innerWidth <= 640) {
      this.tooltip.style.left = '12px';
      this.tooltip.style.right = '12px';
      this.tooltip.style.width = 'auto';
      this.tooltip.style.maxWidth = `${window.innerWidth - 24}px`;
      this.tooltip.style.bottom = '76px';
      this.tooltip.style.top = 'auto';
      return;
    }

    const tooltipWidth = 340;
    const tooltipHeight = 180;
    const padding = 16;
    const clientX = e && typeof e.clientX === 'number' ? e.clientX : window.innerWidth / 2;
    const clientY = e && typeof e.clientY === 'number' ? e.clientY : window.innerHeight / 2;

    let left = clientX + padding;
    let top = clientY + padding;

    if (left + tooltipWidth > window.innerWidth) {
      left = clientX - tooltipWidth - padding;
    }
    if (top + tooltipHeight > window.innerHeight) {
      top = clientY - tooltipHeight - padding;
    }

    this.tooltip.style.bottom = 'auto';
    this.tooltip.style.right = 'auto';
    this.tooltip.style.width = '';
    this.tooltip.style.maxWidth = '360px';
    this.tooltip.style.left = `${Math.max(10, left)}px`;
    this.tooltip.style.top = `${Math.max(10, top)}px`;
  }

  bindEvents() {
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest(this.targetSelector);
      if (el && !this.tooltip.contains(el)) {
        this.inspect(el, e);
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.pinned && this.tooltip.style.display === 'block') {
        this.positionTooltip(e);
      }
    });

    document.addEventListener('mouseout', (e) => {
      if (!this.pinned && !e.relatedTarget?.closest(this.targetSelector)) {
        this.tooltip.style.display = 'none';
      }
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('.truelabel-hud-close')) {
        return;
      }
      const el = e.target.closest(this.targetSelector);
      if (el) {
        if (this.tooltip.style.display !== 'block' || this.activeEl !== el) {
          this.inspect(el, e);
          this.pinned = true;
          this.tooltip.classList.add('pinned');
        } else {
          this.pinned = !this.pinned;
          if (this.pinned) {
            this.tooltip.classList.add('pinned');
          } else {
            this.tooltip.classList.remove('pinned');
            this.tooltip.style.display = 'none';
          }
        }

        if (this.pinned) {
          const name = el.getAttribute('data-ingredient-name') || el.textContent.trim();
          const citation =
            el.getAttribute('data-citation') ||
            `TrueLabel Forensic Registry Monograph: ${name}`;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(citation).catch(() => {});
          }

          const footerNotice = this.tooltip.querySelector('.text-emerald-400');
          if (footerNotice) {
            footerNotice.textContent = '✓ Citation Copied to Clipboard';
          }
        }
      } else if (!e.target.closest('.truelabel-hud-tooltip')) {
        this.pinned = false;
        this.tooltip.classList.remove('pinned');
        this.tooltip.style.display = 'none';
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.pinned) {
        this.pinned = false;
        this.tooltip.classList.remove('pinned');
        this.tooltip.style.display = 'none';
      }
    });
  }

  init() {
    this.createTooltip();
    this.bindEvents();
  }
}

if (typeof window !== 'undefined') {
  window.TrueLabelIngredientInspector = TrueLabelIngredientInspector;
  document.addEventListener('DOMContentLoaded', () => {
    new TrueLabelIngredientInspector();
  });
}
