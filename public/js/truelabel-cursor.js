/**
 * TrueLabel Clinical Mouse Pointer & Inspection Reticle System
 * Faithfully synthesized from Cody Collier's a90.com architecture.
 *
 * Implements:
 * 1. 24x24 pixel-matrix cursor generator with dual-contrast anti-aliased halos.
 * 2. Dual SVG + Canvas PNG data URI fallback chain for 100% cross-browser reliability.
 * 3. Contextual dynamic badges (Ingredient Inspect Lens, Portion Scaler Dial, Safety Shield, Diagonal Arrow).
 * 4. Animated blooming pixel reticle follower for cryptographic batch seals and audit imprints.
 * 5. Automatic WCAG theme contrast matching across dark and light modes with 0ms latency.
 */
(function () {
  'use strict';

  // Guard: Only initialize if the user's primary input device has a fine pointer (mouse/trackpad)
  if (typeof window === 'undefined' || !window.matchMedia || !window.matchMedia('(pointer: fine)').matches) {
    return;
  }

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // 24x24 Logical Grid Size
  var B = 24;
  var de = 1;

  // A90 Signature 11x11 Pixel-Art Pointer Arrow
  var ce = [
    '#',
    '##',
    '###',
    '####',
    '#####',
    '######',
    '#######',
    '####',
    '## ##',
    '#   ##',
    '     ##'
  ];

  // TrueLabel & A90 Contextual 9x9 Badges (Placed at bottom-right of arrow)
  var le = {
    // Fontsight-inspired inspection lens for ingredients
    inspect: [
      ' ####    ',
      '#....#   ',
      '#....#   ',
      '#....#   ',
      '#....#   ',
      ' ######  ',
      '     ### ',
      '      ###',
      '       ##'
    ],
    // Portion scaler & slider precision adjuster
    scale: [
      '    #    ',
      '   ###   ',
      '  # # #  ',
      '#### ####',
      '  # # #  ',
      '   ###   ',
      '    #    '
    ],
    // Ward-inspired safety shield / cryptographic seal
    shield: [
      '#########',
      '#.......#',
      '#..###..#',
      '#.#...#.#',
      '#.#...#.#',
      ' #.....# ',
      '  #...#  ',
      '   #.#   ',
      '    #    '
    ],
    // Diagonal external / action link arrow
    arrow: [
      '     ####',
      '     ####',
      '      ###',
      '   #  ###',
      '  ##   ##',
      ' ###     ',
      '##       '
    ],
    // Standalone clean pixel arrow
    default: null
  };

  // A90 Signature 6-Frame Blooming Pixel Reticle (ye engine)
  var _e = [
    [
      '         ',
      '         ',
      '         ',
      '         ',
      '   ###   ',
      '   ###   ',
      '         ',
      '         ',
      '         '
    ],
    [
      '    #    ',
      '    #    ',
      '   ###   ',
      '  #####  ',
      '#########',
      '  #####  ',
      '   ###   ',
      '    #    ',
      '    #    '
    ],
    [
      '#   #   #',
      ' #  #  # ',
      '  # # #  ',
      '   ###   ',
      '#########',
      '   ###   ',
      '  # # #  ',
      ' #  #  # ',
      '#   #   #'
    ],
    [
      '    #    ',
      '    #    ',
      '## ### ##',
      ' ####### ',
      '  #####  ',
      ' ####### ',
      '## ### ##',
      '    #    ',
      '    #    '
    ],
    [
      '#   #   #',
      ' ## # ## ',
      ' ####### ',
      '  #####  ',
      '#########',
      '  #####  ',
      ' ####### ',
      ' ## # ## ',
      '#   #   #'
    ],
    [
      '##  #  ##',
      '### # ###',
      ' ####### ',
      '  #####  ',
      '#########',
      '  #####  ',
      ' ####### ',
      '### # ###',
      '##  #  ##'
    ]
  ];

  var ve = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1];

  /**
   * Composite arrow and badge into a 24x24 matrix and compute 1px dual-contrast outline
   */
  function fe(badge) {
    var grid = Array.from({ length: B }, function () {
      return Array(B).fill(' ');
    });

    function place(pattern, ox, oy, char) {
      pattern.forEach(function (row, r) {
        Array.from(row).forEach(function (c, col) {
          if (c !== ' ' && r + oy < B && col + ox < B) {
            grid[r + oy][col + ox] = char;
          }
        });
      });
    }

    place(ce, de, de, 'A');
    if (badge) {
      place(badge, 13, 13, 'M');
    }

    var outlined = grid.map(function (row) {
      return row.slice();
    });

    function isFilled(c) {
      return !!c && c !== ' ' && c !== '.';
    }

    for (var r = 0; r < B; r++) {
      for (var c = 0; c < B; c++) {
        if (grid[r][c] === ' ') {
          for (var dr = -1; dr <= 1; dr++) {
            for (var dc = -1; dc <= 1; dc++) {
              if (isFilled(grid[r + dr] && grid[r + dr][c + dc])) {
                outlined[r][c] = '.';
              }
            }
          }
        }
      }
    }
    return outlined;
  }

  /**
   * Frame matrix for blooming reticle follower
   */
  function feReticle(frame) {
    var grid = Array.from({ length: B }, function () {
      return Array(B).fill(' ');
    });
    var ox = Math.floor((B - frame[0].length) / 2);
    var oy = Math.floor((B - frame.length) / 2);

    frame.forEach(function (row, r) {
      Array.from(row).forEach(function (c, col) {
        if (c !== ' ') {
          grid[r + oy][col + ox] = 'M';
        }
      });
    });

    var outlined = grid.map(function (row) {
      return row.slice();
    });

    function isFilled(c) {
      return !!c && c !== ' ' && c !== '.';
    }

    for (var r = 0; r < B; r++) {
      for (var c = 0; c < B; c++) {
        if (grid[r][c] === ' ') {
          for (var dr = -1; dr <= 1; dr++) {
            for (var dc = -1; dc <= 1; dc++) {
              if (isFilled(grid[r + dr] && grid[r + dr][c + dc])) {
                outlined[r][c] = '.';
              }
            }
          }
        }
      }
    }
    return outlined;
  }

  // Relative luminance calculator (sRGB)
  function pe(hex) {
    var t = parseInt(hex.slice(1), 16);
    var n = [t >> 16 & 255, t >> 8 & 255, t & 255].map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2];
  }

  // Generate crisp SVG string from pixel grid (compact 24x24 pixel-for-pixel integer scale)
  function he(grid, theme) {
    var isDark = pe(theme.bg) < 0.35;
    var palette = {
      '.': isDark ? '#000000' : '#ffffff',
      A: theme.fg,
      M: theme.acc
    };
    var paths = {};
    for (var r = 0; r < B; r++) {
      for (var c = 0; c < B; c++) {
        var char = grid[r][c];
        if (char !== ' ' && palette[char]) {
          paths[char] = (paths[char] || '') + 'M' + c + ' ' + r + 'h1v1h-1z';
        }
      }
    }

    var pathElements = Object.keys(paths).map(function (key) {
      return '<path fill="' + palette[key] + '" d="' + paths[key] + '"/>';
    }).join('');

    return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 ' + B + ' ' + B + '" shape-rendering="crispEdges">' + pathElements + '</svg>';
  }

  // Generate crisp PNG data URI fallback using HTML5 canvas (compact 24x24 integer pixels)
  function toPngDataUrl(grid, theme) {
    try {
      var canvas = document.createElement('canvas');
      canvas.width = 24;
      canvas.height = 24;
      var ctx = canvas.getContext('2d');
      if (!ctx) return null;
      var isDark = pe(theme.bg) < 0.35;
      var palette = {
        '.': isDark ? '#000000' : '#ffffff',
        A: theme.fg,
        M: theme.acc
      };
      for (var r = 0; r < B; r++) {
        for (var c = 0; c < B; c++) {
          var char = grid[r][c];
          if (char !== ' ' && palette[char]) {
            ctx.fillStyle = palette[char];
            ctx.fillRect(c, r, 1, 1);
          }
        }
      }
      return canvas.toDataURL('image/png');
    } catch (e) {
      return null;
    }
  }

  // Build dual-source cursor URL fallback declaration: url(svg) 1 1, url(png) 1 1
  function buildCursorUrls(grid, theme) {
    var svg = he(grid, theme);
    var svgUrl = 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '") 1 1';
    var png = toPngDataUrl(grid, theme);
    if (png) {
      var pngUrl = 'url("' + png + '") 1 1';
      return svgUrl + ', ' + pngUrl;
    }
    return svgUrl;
  }

  var currentThemeState = null;
  var reticleFrames = [];

  function getActiveTheme() {
    var isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      return {
        isDark: true,
        bg: '#090d16',
        fg: '#f8fafc',
        acc: '#10b981' // emerald-400
      };
    }
    return {
      isDark: false,
      bg: '#FBFBFB',
      fg: '#0b0b0c',
      acc: '#059669' // emerald-600
    };
  }

  /**
   * Inject and dynamically update cursor rules in document head
   */
  function updateCursorStyles() {
    var theme = getActiveTheme();
    if (currentThemeState && currentThemeState.isDark === theme.isDark) {
      return; // Theme hasn't changed
    }
    currentThemeState = theme;

    var grids = {
      default: fe(le.default),
      inspect: fe(le.inspect),
      scale: fe(le.scale),
      shield: fe(le.shield),
      arrow: fe(le.arrow)
    };

    var cursorUrls = {
      default: buildCursorUrls(grids.default, theme),
      inspect: buildCursorUrls(grids.inspect, theme),
      scale: buildCursorUrls(grids.scale, theme),
      shield: buildCursorUrls(grids.shield, theme),
      arrow: buildCursorUrls(grids.arrow, theme)
    };

    // Pre-cache blooming reticle SVG frames
    reticleFrames = _e.map(function (frame) {
      return 'data:image/svg+xml,' + encodeURIComponent(he(feReticle(frame), theme));
    });
    reticleFrames.forEach(function (src) {
      var img = new Image();
      img.src = src;
    });

    var styleEl = document.getElementById('truelabel-cursor-injected');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'truelabel-cursor-injected';
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = [
      ':root {',
      '  --a90-cursor-default: ' + cursorUrls.default + ';',
      '  --a90-cursor-inspect: ' + cursorUrls.inspect + ';',
      '  --a90-cursor-scale: ' + cursorUrls.scale + ';',
      '  --a90-cursor-shield: ' + cursorUrls.shield + ';',
      '  --a90-cursor-arrow: ' + cursorUrls.arrow + ';',
      '}',
      '@media (pointer: fine) {',
      '  /* Global Body & Document Canvas */',
      '  html, body {',
      '    cursor: ' + cursorUrls.default + ', auto !important;',
      '  }',
      '  /* Standard links, buttons, and clinical cards */',
      '  a, button, [role="button"], input[type="button"], input[type="submit"], select, .btn, .clinical-card, [data-food-card] {',
      '    cursor: ' + cursorUrls.default + ', pointer !important;',
      '  }',
      '  /* Inspectable ingredients */',
      '  [data-inspectable-ingredient], .cursor-help, [data-a90-cursor="inspect"] {',
      '    cursor: ' + cursorUrls.inspect + ', crosshair !important;',
      '  }',
      '  /* Portion Scaler & Range Slider Track and Buttons */',
      '  .serving-slider, [data-serving-scaler] input[type="range"], [data-a90-cursor="scale"], .serving-preset-btn {',
      '    cursor: ' + cursorUrls.scale + ', ew-resize !important;',
      '  }',
      '  .serving-slider::-webkit-slider-thumb, .serving-slider::-moz-range-thumb {',
      '    cursor: ' + cursorUrls.scale + ', grab !important;',
      '  }',
      '  .serving-slider:active::-webkit-slider-thumb, .serving-slider:active::-moz-range-thumb {',
      '    cursor: ' + cursorUrls.scale + ', grabbing !important;',
      '  }',
      '  /* Safety accreditations & audit stamps */',
      '  [data-audit-status], [data-accreditation], .score-badge, [data-a90-cursor="shield"] {',
      '    cursor: ' + cursorUrls.shield + ', pointer !important;',
      '  }',
      '  /* Diagonal arrows and external links */',
      '  .link-diagonal-arrow, a[target="_blank"], [data-a90-cursor="arrow"] {',
      '    cursor: ' + cursorUrls.arrow + ', pointer !important;',
      '  }',
      '}'
    ].join('\n');
  }

  /**
   * Mount animated blooming pixel reticle follower on target elements (ye engine)
   */
  function mountReticleFollower(target) {
    if (!target || target._a90ReticleActive) return;
    target._a90ReticleActive = true;

    var follower = document.createElement('img');
    follower.alt = '';
    follower.setAttribute('aria-hidden', 'true');
    follower.style.cssText = 'position:fixed;left:0;top:0;width:24px;height:24px;z-index:9999;pointer-events:none;image-rendering:pixelated;display:none;';
    document.body.appendChild(follower);

    var frameIdx = 0;
    var timerId = 0;
    var posX = 0;
    var posY = 0;

    function renderPos() {
      follower.style.transform = 'translate(' + (posX - 12) + 'px, ' + (posY - 12) + 'px)';
    }

    function onPointerMove(e) {
      posX = e.clientX;
      posY = e.clientY;
      renderPos();
    }

    target.style.cursor = 'none';

    target.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse') return;
      onPointerMove(e);
      frameIdx = prefersReducedMotion.matches ? 2 : 0;
      follower.src = reticleFrames[ve[frameIdx]];
      follower.style.display = 'block';

      window.addEventListener('pointermove', onPointerMove, { passive: true });
      clearInterval(timerId);

      if (!prefersReducedMotion.matches) {
        timerId = window.setInterval(function () {
          frameIdx = (frameIdx + 1) % ve.length;
          follower.src = reticleFrames[ve[frameIdx]];
        }, 110);
      }
    });

    target.addEventListener('pointerleave', function () {
      follower.style.display = 'none';
      window.removeEventListener('pointermove', onPointerMove);
      clearInterval(timerId);
    });
  }

  function initReticleTargets() {
    var targets = document.querySelectorAll('[data-batch-imprint], .batch-imprint-canvas, [data-a90-reticle]');
    targets.forEach(mountReticleFollower);
  }

  // Initialize
  updateCursorStyles();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initReticleTargets();
    });
  } else {
    initReticleTargets();
  }

  // Observe theme mode toggle in real-time
  var themeObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      if (m.attributeName === 'class') {
        updateCursorStyles();
      }
    });
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  // Expose API for external modules
  window.TrueLabelCursor = {
    updateTheme: updateCursorStyles,
    mountReticle: mountReticleFollower
  };
})();
