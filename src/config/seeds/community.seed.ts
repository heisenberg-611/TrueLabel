import { SeedReviewDefinition, SeedReportDefinition } from './types';

export const SEED_REVIEWS: SeedReviewDefinition[] = [
  // 1. Oatly Barista Drink (Oatly)
  {
    productBarcode: '7394376311482',
    userEmail: 'consumer@truelabel.demo',
    tasteRating: 5,
    labelAccuracyRating: 5,
    packagingRating: 5,
    purchaseExperienceRating: 4,
    rating: 5,
    credibilityWeight: 1.14,
    visibility: 'visible',
    title: 'Clean oat flavor and very clear allergen disclosure',
    comment:
      'Steams cleanly for espresso without separating. The nutrition table and oat percentage printed on the carton match TrueLabel exactly, and the cap seal was completely intact.',
    manufacturerReply:
      'Thank you for the detailed feedback, Sharah. Every Oatly Barista carton undergoes seal-integrity testing before dispatch.',
    repliedAt: '2026-11-16T10:30:00.000Z',
  },
  {
    productBarcode: '7394376311482',
    userEmail: 'tariq.consumer@truelabel.demo',
    tasteRating: 4,
    labelAccuracyRating: 5,
    packagingRating: 4,
    purchaseExperienceRating: 4,
    rating: 4,
    credibilityWeight: 1.06,
    visibility: 'visible',
    title: 'Good dairy-free alternative, slightly pricey locally',
    comment:
      'Ingredient panel is straightforward with zero hidden dairy allergens. Packaging arrived unbruised, though stock sells out quickly at neighborhood supermarkets.',
    manufacturerReply: null,
    repliedAt: null,
  },

  // 2. Chobani Non-Fat Plain Greek Yogurt (Chobani)
  {
    productBarcode: '089470001382',
    userEmail: 'tariq.consumer@truelabel.demo',
    tasteRating: 5,
    labelAccuracyRating: 5,
    packagingRating: 4,
    purchaseExperienceRating: 5,
    rating: 5,
    credibilityWeight: 1.08,
    visibility: 'visible',
    title: 'Thick texture and transparent protein count',
    comment:
      'High protein per serving with zero added refined sugar. The foil lid seal was tight and cold-chain storage at the store kept it fresh.',
    manufacturerReply: null,
    repliedAt: null,
  },
  {
    productBarcode: '089470001382',
    userEmail: 'kabir.health@truelabel.demo',
    tasteRating: 5,
    labelAccuracyRating: 5,
    packagingRating: 5,
    purchaseExperienceRating: 5,
    rating: 5,
    credibilityWeight: 1.12,
    visibility: 'visible',
    title: 'Exceptional for cardiovascular and low-sodium diets',
    comment:
      'Zero added sodium and 15g protein per serving helps meet my cardiovascular diet targets without compromising gut microbiome diversity.',
    manufacturerReply: null,
    repliedAt: null,
  },

  // 3. Coca-Cola Original Taste (Coca-Cola)
  {
    productBarcode: '5449000000996',
    userEmail: 'consumer@truelabel.demo',
    tasteRating: 4,
    labelAccuracyRating: 3,
    packagingRating: 5,
    purchaseExperienceRating: 4,
    rating: 4,
    credibilityWeight: 1.14,
    visibility: 'visible',
    title: 'Familiar taste, but sugar and E150d additives stand out',
    comment:
      'Can seal and carbonation were consistent, but checking the nutrition breakdown here highlighted 10.6g sugar per 100ml and caramel color E150d which is easy to miss on the small printed panel.',
    manufacturerReply: null,
    repliedAt: null,
  },

  // 4. Barilla Spaghetti No. 5 (Barilla)
  {
    productBarcode: '8076800195057',
    userEmail: 'maya.celiac@truelabel.demo',
    tasteRating: 4,
    labelAccuracyRating: 5,
    packagingRating: 4,
    purchaseExperienceRating: 4,
    rating: 4,
    credibilityWeight: 1.18,
    visibility: 'visible',
    title: 'Clear gluten declaration on blue cardboard packaging',
    comment:
      'TrueLabel correctly identified 100% durum wheat semolina as containing gluten. The packaging clearly flags wheat allergy risk for celiac households.',
    manufacturerReply:
      'We appreciate your feedback, Maya. For celiac dietary needs, please explore our certified Barilla Gluten-Free corn-rice blend line.',
    repliedAt: '2026-11-18T14:20:00.000Z',
  },

  // 5. Amy's Organic Black Bean Chili (Amy's Kitchen)
  {
    productBarcode: '042272005017',
    userEmail: 'maya.celiac@truelabel.demo',
    tasteRating: 5,
    labelAccuracyRating: 5,
    packagingRating: 5,
    purchaseExperienceRating: 5,
    rating: 5,
    credibilityWeight: 1.20,
    visibility: 'visible',
    title: 'Outstanding certified gluten-free & vegan meal',
    comment:
      'Zero cross-contamination symptoms, rich smoky organic cumin and bean flavor, and the BPA-free can lining gives peace of mind.',
    manufacturerReply: null,
    repliedAt: null,
  },

  // 6. Kikkoman Naturally Brewed Soy Sauce (Kikkoman)
  {
    productBarcode: '4901515120152',
    userEmail: 'tariq.consumer@truelabel.demo',
    tasteRating: 5,
    labelAccuracyRating: 5,
    packagingRating: 5,
    purchaseExperienceRating: 4,
    rating: 5,
    credibilityWeight: 1.05,
    visibility: 'visible',
    title: 'Authentic 4-ingredient umami seasoning',
    comment:
      'Only water, soybeans, wheat, and salt. No added MSG or artificial caramel colors. Bottle dispenser cap works cleanly without drips.',
    manufacturerReply: null,
    repliedAt: null,
  },

  // 7. PRAN Frooto Mango Fruit Drink (PRAN Foods)
  {
    productBarcode: '0831730009403',
    userEmail: 'kabir.health@truelabel.demo',
    tasteRating: 3,
    labelAccuracyRating: 4,
    packagingRating: 3,
    purchaseExperienceRating: 3,
    rating: 3,
    credibilityWeight: 1.10,
    visibility: 'visible',
    title: 'Very sweet; high refined sugar per single bottle',
    comment:
      'Flavor is nostalgic, but 12.8g sugar per 100ml adds up to over 32g in a single bottle. The packaging also feels prone to leaking if squeezed.',
    manufacturerReply: null,
    repliedAt: null,
  },
];

export const SEED_REPORTS: SeedReportDefinition[] = [
  // Intentional 3-consumer batch cluster anomaly on PRAN Frooto (batchCode: BATCH-FRT-2026-09)
  // This activates TrueLabel's automated batch cluster detection algorithm in the inspector/admin dashboard!
  {
    productBarcode: '0831730009403',
    userEmail: 'consumer@truelabel.demo',
    category: 'damaged',
    batchCode: 'BATCH-FRT-2026-09',
    purchasePlace: 'Banani Road 11 Supermart, Dhaka',
    referenceNumber: 'TL-20261116-FRT001A1',
    description:
      'Purchased a 250ml mango drink pack from the chilled shelf; the bottom corner seam was visibly bulging and leaking sticky residue despite expiry date reading May 2027.',
    status: 'pending',
  },
  {
    productBarcode: '0831730009403',
    userEmail: 'tariq.consumer@truelabel.demo',
    category: 'spoiled',
    batchCode: 'BATCH-FRT-2026-09',
    purchasePlace: 'Gulshan 2 Convenience Store, Dhaka',
    referenceNumber: 'TL-20261117-FRT002B2',
    description:
      'Opened a carton from batch BATCH-FRT-2026-09 and noticed a strong fermented sour smell immediately upon piercing the seal. Did not consume the drink.',
    status: 'investigating',
  },
  {
    productBarcode: '0831730009403',
    userEmail: 'anika.consumer@truelabel.demo',
    category: 'contaminated',
    batchCode: 'BATCH-FRT-2026-09',
    purchasePlace: 'Dhanmondi Shwapno Superstore, Dhaka',
    referenceNumber: 'TL-20261118-FRT003C3',
    description:
      'Carton showed dark particulate mold sediment suspended in the juice upon pouring into a glass. Third reported issue for batch BATCH-FRT-2026-09 triggering automated cluster detection.',
    status: 'investigating',
  },

  // Report 4: Coca-Cola mislabelling
  {
    productBarcode: '5449000000996',
    userEmail: 'consumer@truelabel.demo',
    category: 'mislabelled',
    batchCode: 'CC-26-4412',
    purchasePlace: 'Dhanmondi Satmasjid Rd Grocer, Dhaka',
    referenceNumber: 'TL-20261117-CC003C3',
    description:
      'The printed best-before date stamp on the bottle neck was heavily smudged and unreadable, and the secondary import sticker partially covered the nutrition per 100ml column.',
    status: 'pending',
  },

  // Report 5: Barilla Pasta damaged carton
  {
    productBarcode: '8076800195057',
    userEmail: 'tariq.consumer@truelabel.demo',
    category: 'damaged',
    batchCode: 'BAR-IT-8821',
    purchasePlace: 'Unimart Gulshan, Dhaka',
    referenceNumber: 'TL-20261118-BAR004D4',
    description:
      'Outer cardboard package arrived crushed and the transparent plastic viewing window was punctured with several broken pasta shards spilling into the shopping bag.',
    status: 'resolved',
  },
];
