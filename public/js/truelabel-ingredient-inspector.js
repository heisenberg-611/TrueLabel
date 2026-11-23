/**
 * TrueLabel Forensic Ingredient & E-Number Micro-Inspector
 * Adapted from Fontsight's DOM Hover Inspector Component
 * 
 * Hover over inspectable ingredients, additives, or allergens to view clinical
 * toxicology data, FDA/EU regulatory status, and 1-click copy chemical citations.
 */

class TrueLabelIngredientInspector {
  constructor(options = {}) {
    this.targetSelector = options.targetSelector || '[data-inspectable-ingredient], [data-ingredient-name]';
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

  inspect(el, e) {
    if (this.pinned) return;
    this.activeEl = el;

    const name = el.getAttribute('data-ingredient-name') || el.textContent.trim();
    const hazard = el.getAttribute('data-hazard') || 'safe';
    const hazardDetail = el.getAttribute('data-hazard-detail') || '';
    const fdaStatus = el.getAttribute('data-fda-status') || 'FDA Evaluated';
    const euStatus = el.getAttribute('data-eu-status') || 'EU Registered';
    const allergen = el.getAttribute('data-allergen') || '';
    const citation = el.getAttribute('data-citation') || `TrueLabel Forensic Registry: Chemical Specification for ${name}`;

    // Hazard Tier Badge Color
    let hazardBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-700">Clinical Tier 1: Safe</span>';
    if (hazard === 'warning' || hazard === 'caution') {
      hazardBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-950 text-amber-300 border border-amber-700">Tier 2: Cautionary</span>';
    } else if (hazard === 'hazard' || hazard === 'banned') {
      hazardBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-950 text-rose-300 border border-rose-700">Tier 3: Statutory Hazard</span>';
    }

    let allergenSnippet = '';
    if (allergen && allergen !== 'false') {
      allergenSnippet = `<div class="mt-1 text-[11px] font-semibold text-rose-400">⚠️ Declared Allergen: ${allergen}</div>`;
    }

    this.tooltip.innerHTML = `
      <div class="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-white/10">
        <span class="font-bold text-white text-[13px] tracking-tight">${name}</span>
        ${hazardBadge}
      </div>
      <div class="space-y-1 text-[11px] text-slate-300">
        <div class="flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span>FDA: <strong class="text-slate-200">${fdaStatus}</strong></span>
          <span>EU: <strong class="text-slate-200">${euStatus}</strong></span>
        </div>
        ${hazardDetail ? `<p class="pt-1 text-slate-300 leading-snug">${hazardDetail}</p>` : ''}
        ${allergenSnippet}
      </div>
      <div class="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
        <span class="text-emerald-400 font-mono font-medium">Click to pin & copy citation</span>
        <span class="text-slate-500 font-mono">TrueLabel HUD</span>
      </div>
    `;

    this.tooltip.style.display = 'block';
    this.positionTooltip(e);
  }

  positionTooltip(e) {
    const tooltipWidth = 320;
    const tooltipHeight = 160;
    const padding = 16;

    let left = e.clientX + padding;
    let top = e.clientY + padding;

    if (left + tooltipWidth > window.innerWidth) {
      left = e.clientX - tooltipWidth - padding;
    }
    if (top + tooltipHeight > window.innerHeight) {
      top = e.clientY - tooltipHeight - padding;
    }

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
      const el = e.target.closest(this.targetSelector);
      if (el) {
        this.pinned = !this.pinned;
        if (this.pinned) {
          this.tooltip.classList.add('pinned');
          const name = el.getAttribute('data-ingredient-name') || el.textContent.trim();
          const citation = el.getAttribute('data-citation') || `TrueLabel Forensic Registry Monograph: ${name}`;
          navigator.clipboard.writeText(citation).catch(() => {});

          const footerNotice = this.tooltip.querySelector('.text-emerald-400');
          if (footerNotice) {
            footerNotice.textContent = '✓ Citation Copied to Clipboard!';
          }
        } else {
          this.tooltip.classList.remove('pinned');
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
