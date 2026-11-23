/**
 * TrueLabel Interactive Dynamic Serving Scaler & Nutrition Waterfall
 * Adapted from Fontsight's Waterfall Specimen Tester & Range Rail
 * 
 * Adjusts serving sizes in real-time, dynamically recalculating calorie counts,
 * nutrient masses, and percentage Daily Values (% DV) across the FDA nutrition panel.
 */

class TrueLabelServingScaler {
  constructor(container) {
    this.container = container;
    this.slider = container.querySelector('[data-serving-slider]');
    this.servingDisplays = Array.from(container.querySelectorAll('[data-serving-display]'));
    this.baseServing = parseFloat(container.getAttribute('data-base-serving')) || 100;
    this.servingUnit = container.getAttribute('data-serving-unit') || 'g';
    this.nutrientElements = Array.from(container.querySelectorAll('[data-base-nutrient]'));
    this.presetButtons = Array.from(container.querySelectorAll('[data-preset-val]'));
    this.init();
  }

  updateTrackFill(val) {
    if (!this.slider) return;
    const min = parseFloat(this.slider.min) || 10;
    const max = parseFloat(this.slider.max) || 250;
    const percent = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
    const isDark = document.documentElement.classList.contains('dark');
    const trackEmptyColor = isDark ? '#27272a' : '#e2e8f0';
    this.slider.style.background = `linear-gradient(to right, #059669 0%, #10b981 ${percent}%, ${trackEmptyColor} ${percent}%, ${trackEmptyColor} 100%)`;
  }

  updatePresetActive(servingSize) {
    this.presetButtons.forEach((btn) => {
      const presetVal = parseFloat(btn.getAttribute('data-preset-val'));
      if (presetVal === servingSize) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  update(servingSize) {
    const ratio = servingSize / this.baseServing;

    // Update ALL elements displaying the serving size (both header and inside nutrition fact panel)
    this.servingDisplays.forEach((el) => {
      el.textContent = `${servingSize}${this.servingUnit}`;
    });

    // Update track progress fill and preset buttons
    this.updateTrackFill(servingSize);
    this.updatePresetActive(servingSize);

    // Recalculate each nutrient dynamically
    this.nutrientElements.forEach((el) => {
      const baseVal = parseFloat(el.getAttribute('data-base-val')) || 0;
      const unit = el.getAttribute('data-base-unit') || 'g';
      const dvDaily = parseFloat(el.getAttribute('data-dv-daily')) || 0;
      const nutrientName = el.getAttribute('data-base-nutrient');

      const currentVal = Math.round(baseVal * ratio * 10) / 10;
      const valDisplay = el.querySelector('[data-val-display]');
      if (valDisplay) {
        if (nutrientName === 'Energy') {
          valDisplay.textContent = `${Math.round(currentVal)}`;
        } else {
          valDisplay.textContent = `${currentVal}${unit}`;
        }
      }

      if (dvDaily > 0) {
        const dvPercent = Math.min(250, Math.round((currentVal / dvDaily) * 100));
        const dvDisplay = el.querySelector('[data-dv-display]');
        if (dvDisplay) {
          dvDisplay.textContent = `${dvPercent}%`;
        }

        const barFill = el.querySelector('.nutrition-waterfall-fill');
        if (barFill) {
          barFill.style.width = `${Math.min(100, dvPercent)}%`;

          // Dynamic safety tier color shifts
          if (dvPercent >= 50) {
            if (['sodium', 'sugars', 'saturatedFat', 'transFat', 'Salt', 'Sugars', 'Saturated Fat'].includes(nutrientName)) {
              barFill.style.backgroundColor = '#be123c'; // Crimson hazard
            } else {
              barFill.style.backgroundColor = '#047857'; // High protein/fiber
            }
          } else if (dvPercent >= 20) {
            barFill.style.backgroundColor = '#b45309'; // Amber moderate
          } else {
            barFill.style.backgroundColor = '#047857'; // Green
          }
        }
      }
    });
  }

  init() {
    if (!this.slider) return;

    // Slider input event (dragging or clicking track)
    this.slider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.update(val);
    });

    // Click events for preset buttons (instant mouse pointer selection)
    this.presetButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const presetVal = parseFloat(btn.getAttribute('data-preset-val'));
        if (!isNaN(presetVal)) {
          this.slider.value = presetVal;
          this.update(presetVal);
        }
      });
    });

    // Initial render
    this.update(parseFloat(this.slider.value) || this.baseServing);
  }
}

if (typeof window !== 'undefined') {
  window.TrueLabelServingScaler = TrueLabelServingScaler;
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.serving-scaler-container').forEach((el) => {
      new TrueLabelServingScaler(el);
    });
  });
}
