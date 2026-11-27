import { INestApplication } from '@nestjs/common';
import { join } from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as session from 'express-session';
import * as hbs from 'hbs';

export function configureE2eApp(app: INestApplication): void {
  (app as any).setBaseViewsDir(join(__dirname, '..', 'src'));
  (app as any).setViewEngine('hbs');

  const partialsDir = join(__dirname, '..', 'src', 'shared', 'views', 'partials');
  if (fs.existsSync(partialsDir)) {
    const filenames = fs.readdirSync(partialsDir);
    filenames.forEach((filename) => {
      if (filename.endsWith('.hbs')) {
        const matches = /^([^.]+)\.hbs$/.exec(filename);
        if (!matches) return;
        const name = matches[1];
        const template = fs.readFileSync(join(partialsDir, filename), 'utf8');
        hbs.registerPartial(name, template);
        if (name.startsWith('_')) {
          hbs.registerPartial(name.substring(1), template);
        }
      }
    });
  }

  hbs.registerPartials(partialsDir);
  (app as any).set('view options', {
    layout: 'shared/views/layouts/main',
  });

  hbs.registerHelper('eq', (a, b) => a === b);
  hbs.registerHelper('ne', (a, b) => a !== b);
  hbs.registerHelper('or', (a, b) => a || b);
  hbs.registerHelper('and', (a, b) => a && b);
  hbs.registerHelper('gte', (a, b) => a >= b);
  hbs.registerHelper('lte', (a, b) => a <= b);
  hbs.registerHelper('gt', (a, b) => a > b);
  hbs.registerHelper('lt', (a, b) => a < b);
  hbs.registerHelper('add', (a, b) => Number(a) + Number(b));
  hbs.registerHelper('subtract', (a, b) => Number(a) - Number(b));
  hbs.registerHelper('urlEncode', (val: any) => encodeURIComponent(String(val || '')));
  hbs.registerHelper('includes', (arr: any, val: any) => {
    if (!arr) return false;
    if (Array.isArray(arr)) {
      return arr.some((item) => String(item).toLowerCase() === String(val).toLowerCase());
    }
    if (typeof arr === 'string') {
      return arr.toLowerCase().includes(String(val).toLowerCase());
    }
    return false;
  });

  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    }),
  );

  app.use((req: any, res: any, next: any) => {
    if (req.session) {
      if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
      }
      res.locals.csrfToken = req.session.csrfToken;
    }
    next();
  });
}
