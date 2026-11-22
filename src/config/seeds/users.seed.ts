import { SeedUserDefinition } from './types';

export const SEED_USERS: SeedUserDefinition[] = [
  // 1. Consumers with diverse dietary / health profiles
  {
    name: 'Sharah Consumer',
    email: 'consumer@truelabel.demo',
    role: 'consumer',
    isVerified: true,
  },
  {
    name: 'Tariq Rahman',
    email: 'tariq.consumer@truelabel.demo',
    role: 'consumer',
    isVerified: true,
  },
  {
    name: 'Maya Lin (Celiac & Dairy Free)',
    email: 'maya.celiac@truelabel.demo',
    role: 'consumer',
    isVerified: true,
  },
  {
    name: 'Kabir Chowdhury (Cardio & Low-Sodium)',
    email: 'kabir.health@truelabel.demo',
    role: 'consumer',
    isVerified: true,
  },
  {
    name: 'Anika Hasan (Parent & School Nutrition)',
    email: 'anika.consumer@truelabel.demo',
    role: 'consumer',
    isVerified: true,
  },

  // 2. Verified Brand Manufacturers
  {
    name: 'PureHarvest & Aarong Dairy',
    email: 'manufacturer@truelabel.demo',
    role: 'manufacturer',
    isVerified: true,
  },
  {
    name: 'PRAN Foods Ltd.',
    email: 'pran@truelabel.demo',
    role: 'manufacturer',
    isVerified: true,
  },
  {
    name: 'Nestlé Bangladesh Ltd.',
    email: 'nestle@truelabel.demo',
    role: 'manufacturer',
    isVerified: true,
  },
  {
    name: 'Oatly AB',
    email: 'oatly@truelabel.demo',
    role: 'manufacturer',
    isVerified: true,
  },
  {
    name: 'The Kraft Heinz Company',
    email: 'heinz@truelabel.demo',
    role: 'manufacturer',
    isVerified: true,
  },
  {
    name: 'Barilla G. e R. Fratelli SpA',
    email: 'barilla@truelabel.demo',
    role: 'manufacturer',
    isVerified: true,
  },
  {
    name: 'Ferrero SpA (Nutella)',
    email: 'ferrero@truelabel.demo',
    role: 'manufacturer',
    isVerified: true,
  },
  {
    name: 'Amy\'s Kitchen Inc.',
    email: 'amys@truelabel.demo',
    role: 'manufacturer',
    isVerified: true,
  },
  {
    name: 'Danone / Silk Plant Foods',
    email: 'silk@truelabel.demo',
    role: 'manufacturer',
    isVerified: true,
  },
  {
    name: 'Kikkoman Corporation',
    email: 'kikkoman@truelabel.demo',
    role: 'manufacturer',
    isVerified: true,
  },

  // 3. Accredited Safety Inspectors
  {
    name: 'Dr. Marcus Vance (Chief Food Safety Inspector)',
    email: 'inspector@truelabel.demo',
    role: 'inspector',
    isVerified: true,
  },
  {
    name: 'Dr. Ananya Sen (Toxicology & Allergen Specialist)',
    email: 'ananya.inspector@truelabel.demo',
    role: 'inspector',
    isVerified: true,
  },

  // 4. Platform System Administrators
  {
    name: 'Lead System Admin',
    email: 'admin@truelabel.demo',
    role: 'admin',
    isVerified: true,
  },
  {
    name: 'Audit Compliance Officer',
    email: 'compliance.admin@truelabel.demo',
    role: 'admin',
    isVerified: true,
  },
];
