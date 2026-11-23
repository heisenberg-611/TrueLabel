/**
 * TrueLabel Regulatory Zone Scroll-Driven Atmosphere Engine
 * Adapted from A90's ScrollTheme system
 * 
 * Dynamically shifts root CSS variables (--zone-page, --zone-text, --zone-acc)
 * as users scroll past different regulatory and safety dossier zones.
 */

class TrueLabelThemeScroll {
  constructor(options = {}) {
    this.selector = options.selector || '[data-regulatory-zone]';
    this.root = options.root || document.documentElement;
    this.activeZoneId = null;
    this.init();
  }

  setZoneTheme(zone) {
    if (!zone) return;
    if (zone.bg) this.root.style.setProperty('--zone-page', zone.bg);
    if (zone.fg) this.root.style.setProperty('--zone-text', zone.fg);
    if (zone.acc) this.root.style.setProperty('--zone-acc', zone.acc);

    this.root.style.setProperty(
      '--zone-line',
      `color-mix(in srgb, ${zone.fg || 'var(--zone-text)'} 14%, ${zone.bg || 'var(--zone-page)'})`
    );
    this.root.style.setProperty(
      '--zone-mute',
      `color-mix(in srgb, ${zone.fg || 'var(--zone-text)'} 55%, ${zone.bg || 'var(--zone-page)'})`
    );
  }

  init() {
    // Respect reduced motion preference
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const zones = document.querySelectorAll(this.selector);
    if (!zones.length) return;

    const visibilityMap = new Map();

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        visibilityMap.set(entry.target, entry.intersectionRatio);
      });

      // Find zone with highest visibility ratio
      const sorted = [...visibilityMap.entries()].sort((a, b) => b[1] - a[1]);
      const topEntry = sorted[0];

      if (topEntry && topEntry[1] > 0.15) {
        const target = topEntry[0];
        const zoneData = {
          bg: target.getAttribute('data-bg'),
          fg: target.getAttribute('data-fg'),
          acc: target.getAttribute('data-acc'),
          id: target.getAttribute('data-regulatory-zone') || target.id || 'zone',
        };

        if (this.activeZoneId !== zoneData.id) {
          this.activeZoneId = zoneData.id;
          this.setZoneTheme(zoneData);
          document.dispatchEvent(new CustomEvent('truelabel:zonechange', { detail: zoneData }));
        }
      }
    }, {
      threshold: Array.from({ length: 21 }, (_, i) => i / 20),
    });

    zones.forEach((zone) => observer.observe(zone));
  }
}

if (typeof window !== 'undefined') {
  window.TrueLabelThemeScroll = TrueLabelThemeScroll;
  document.addEventListener('DOMContentLoaded', () => {
    new TrueLabelThemeScroll();
  });
}
