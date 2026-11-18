import * as fs from 'fs';
import * as path from 'path';

describe('Dark Mode System Architecture', () => {
  const mainLayoutPath = path.resolve(__dirname, 'layouts/main.hbs');
  const navbarPartialPath = path.resolve(__dirname, 'partials/navbar.hbs');
  const footerPartialPath = path.resolve(__dirname, 'partials/footer.hbs');
  const loginViewPath = path.resolve(process.cwd(), 'src/areas/identity/views/login.hbs');
  const registerViewPath = path.resolve(process.cwd(), 'src/areas/identity/views/register.hbs');
  const styleCssPath = path.resolve(process.cwd(), 'public/css/style.css');

  describe('Main Layout (main.hbs)', () => {
    let mainLayoutContent: string;

    beforeAll(() => {
      mainLayoutContent = fs.readFileSync(mainLayoutPath, 'utf-8');
    });

    it('should configure Tailwind darkMode using class strategy', () => {
      expect(mainLayoutContent).toContain("darkMode: 'class'");
    });

    it('should include early anti-FOUC theme resolution script in head defaulting to day mode', () => {
      expect(mainLayoutContent).toContain("localStorage.getItem('truelabel_theme')");
      expect(mainLayoutContent).toContain("savedTheme === 'dark'");
      expect(mainLayoutContent).toContain("document.documentElement.classList.add('dark')");
      expect(mainLayoutContent).toContain("document.documentElement.classList.remove('dark')");
    });

    it('should declare dark background and text classes on body', () => {
      expect(mainLayoutContent).toContain('dark:bg-[#090d16]');
      expect(mainLayoutContent).toContain('dark:text-slate-100');
    });
  });

  describe('Navbar Partial (navbar.hbs)', () => {
    let navbarContent: string;

    beforeAll(() => {
      navbarContent = fs.readFileSync(navbarPartialPath, 'utf-8');
    });

    it('should contain desktop theme toggle button with sun and moon icons', () => {
      expect(navbarContent).toContain('id="theme-toggle-desktop"');
      expect(navbarContent).toContain('id="theme-sun-desktop"');
      expect(navbarContent).toContain('id="theme-moon-desktop"');
    });

    it('should contain mobile header and drawer theme toggle controls', () => {
      expect(navbarContent).toContain('id="theme-toggle-mobile-header"');
      expect(navbarContent).toContain('id="theme-toggle-drawer"');
    });

    it('should contain client-side persistence and toggle handler script', () => {
      expect(navbarContent).toContain("document.documentElement.classList.toggle('dark')");
      expect(navbarContent).toContain("localStorage.setItem('truelabel_theme'");
      expect(navbarContent).toContain('updateThemeUI');
    });
  });

  describe('Stylesheet (style.css)', () => {
    let cssContent: string;

    beforeAll(() => {
      cssContent = fs.readFileSync(styleCssPath, 'utf-8');
    });

    it('should declare html.dark CSS variables for ink, surfaces, and borders', () => {
      expect(cssContent).toContain('html.dark');
      expect(cssContent).toContain('--surface: #0f172a');
      expect(cssContent).toContain('--surface-alt: #090d16');
      expect(cssContent).toContain('--border-light: #1e293b');
    });

    it('should define dark mode rules for FDA nutrition panel', () => {
      expect(cssContent).toContain('html.dark .nutrition-panel');
      expect(cssContent).toContain('html.dark .nutrition-row');
      expect(cssContent).toContain('html.dark .nutrition-calories-number');
    });

    it('should define dark mode rules for form selects and inputs', () => {
      expect(cssContent).toContain('html.dark select');
      expect(cssContent).toContain('html.dark input[type="text"]');
    });

    it('should define dark mode rules for allergen and additive indicators', () => {
      expect(cssContent).toContain('html.dark .allergen-pill');
      expect(cssContent).toContain('html.dark .additive-pill');
    });

    it('should define anti-FOUC dark/light brand logo visibility rules', () => {
      expect(cssContent).toContain('.brand-logo-light');
      expect(cssContent).toContain('.brand-logo-dark');
      expect(cssContent).toContain('html.dark .brand-logo-light');
      expect(cssContent).toContain('html.dark .brand-logo-dark');
    });
  });

  describe('Brand Logo & Favicon Integration', () => {
    it('should provide optimized light, dark, mark, wordmark, and favicon assets in public/', () => {
      const expectedAssets = [
        'public/favicon.png',
        'public/images/logo.png',
        'public/images/logo-dark.png',
        'public/images/logo-mark.png',
        'public/images/logo-mark-dark.png',
        'public/images/logo-wordmark.png',
        'public/images/logo-wordmark-dark.png',
      ];
      for (const relPath of expectedAssets) {
        expect(fs.existsSync(path.resolve(process.cwd(), relPath))).toBe(true);
      }
    });

    it('should declare favicon links in main layout', () => {
      const mainLayoutContent = fs.readFileSync(mainLayoutPath, 'utf-8');
      expect(mainLayoutContent).toContain('href="/favicon.png"');
    });

    it('should render light and dark emblem marks and logo wordmarks in navbar', () => {
      const navbarContent = fs.readFileSync(navbarPartialPath, 'utf-8');
      expect(navbarContent).toContain('/images/logo-mark.png');
      expect(navbarContent).toContain('/images/logo-mark-dark.png');
      expect(navbarContent).toContain('/images/logo-wordmark.png');
      expect(navbarContent).toContain('/images/logo-wordmark-dark.png');
    });

    it('should render light and dark full logos in footer and auth views', () => {
      for (const viewPath of [footerPartialPath, loginViewPath, registerViewPath]) {
        const content = fs.readFileSync(viewPath, 'utf-8');
        expect(content).toContain('/images/logo.png');
        expect(content).toContain('/images/logo-dark.png');
      }
    });
  });
});
