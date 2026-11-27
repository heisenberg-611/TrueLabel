import { FoodRuleType } from '../../areas/admin/models/food-rule.entity';
import { HazardLevel } from '../../areas/food-catalog/models/ingredient.entity';

export interface SeedFoodRuleDefinition {
  name: string;
  pattern: string;
  ruleType: FoodRuleType;
  additiveCode?: string | null;
  allergenType?: string | null;
  categoryScope?: string | null;
  hazardLevel: HazardLevel;
  fdaStatus: string;
  euStatus: string;
  explanation: string;
  source: string;
  isActive?: boolean;
}

/**
 * Feature F03: Curated Administrative Food Rule Base
 * Compiled from EU Regulation No 1169/2011 Annex II (allergens), EFSA food additive evaluations,
 * FDA 21 CFR GRAS/Color/Food Additive listings, Codex Alimentarius, and BFSA/BSTI directives.
 */
export const SEED_FOOD_RULES: SeedFoodRuleDefinition[] = [
  // =========================================================
  // 1. MAJOR STATUTORY ALLERGENS (EU Reg 1169/2011 & FDA FALCPA/FASTER)
  // =========================================================
  {
    name: 'Dairy Milk & Lactose Allergens',
    pattern:
      'cow milk, whole cow milk, nonfat milk, skim milk, skimmed milk, skimmed milk powder, milk powder, dairy, whey, casein, butter, concentrated butter, cheese, ricotta, mozzarella, parmesan, cream, fresh cream, yogurt, lactose, buttermilk',
    ruleType: 'allergen',
    allergenType: 'Milk',
    hazardLevel: 'safe',
    fdaStatus: 'FDA Major Allergen (FALCPA)',
    euStatus: 'EU Annex II Mandatory Allergen',
    explanation:
      'Contains bovine milk proteins (casein/whey) or lactose; safe for general consumption but requires mandatory allergen declaration for dairy-allergic individuals.',
    source: 'EU Reg 1169/2011 Annex II / FDA FALCPA',
  },
  {
    name: 'Peanut & Groundnut Allergen',
    pattern: 'peanut, peanuts, peanut flour, peanut paste, groundnut, groundnut protein, hydrolysed groundnut protein',
    ruleType: 'allergen',
    allergenType: 'Peanut',
    hazardLevel: 'safe',
    fdaStatus: 'FDA Major Allergen (FALCPA)',
    euStatus: 'EU Annex II Mandatory Allergen',
    explanation:
      'Legume allergen capable of triggering severe IgE-mediated anaphylaxis; strictly requires clear front-of-pack and ingredient declaration.',
    source: 'EU Reg 1169/2011 Annex II / FDA FALCPA',
  },
  {
    name: 'Undeclared Allergen Contamination',
    pattern: 'undeclared peanut, undeclared allergen',
    ruleType: 'allergen',
    allergenType: 'Peanut',
    hazardLevel: 'warning',
    fdaStatus: 'FDA Class I Recall Hazard',
    euStatus: 'RASFF Critical Allergen Alert',
    explanation:
      'Confirmed undeclared life-threatening allergen residue detected without statutory warning labels; triggers immediate recall risk.',
    source: 'BFSA / FDA Class I Recall Directive',
  },
  {
    name: 'Tree Nut Allergens',
    pattern: 'almond, almonds, almondmilk, hazelnut, hazelnuts, walnut, walnuts, cashew, cashews, pistachio, pecan, macadamia, tree nut',
    ruleType: 'allergen',
    allergenType: 'Tree Nut',
    hazardLevel: 'safe',
    fdaStatus: 'FDA Major Allergen (FALCPA)',
    euStatus: 'EU Annex II Mandatory Allergen',
    explanation:
      'Tree nut protein family; nutritious for the general population but poses high anaphylactic risk to sensitized consumers.',
    source: 'EU Reg 1169/2011 Annex II / FDA FALCPA',
  },
  {
    name: 'Gluten & Cereal Grain Allergens',
    pattern: 'wheat, wheat flour, wholemeal wheat flour, wheat starch, wheat gluten, barley, barley malt, malted barley, rye, spelt, oats, oat base, wholegrain wheat',
    ruleType: 'allergen',
    allergenType: 'Gluten',
    hazardLevel: 'safe',
    fdaStatus: 'FDA Wheat Allergen Regulated',
    euStatus: 'EU Annex II Gluten Cereal',
    explanation:
      'Cereal protein containing gluten/avenin fractions; unsafe for celiac disease or wheat-allergic consumers unless certified gluten-free.',
    source: 'EU Reg 1169/2011 Annex II / Codex STAN 118',
  },
  {
    name: 'Soy & Soy Protein Allergens',
    pattern: 'soy, soya, soybean, soybeans, soy sauce, soy protein, hydrolyzed soy protein, soy lecithin, soya lecithin, soymilk, soybean oil',
    ruleType: 'allergen',
    allergenType: 'Soy',
    hazardLevel: 'safe',
    fdaStatus: 'FDA Major Allergen (FALCPA)',
    euStatus: 'EU Annex II Mandatory Allergen',
    explanation:
      'Soybean-derived protein or emulsifier; requires mandatory allergen labeling under both FDA and EU food law.',
    source: 'EU Reg 1169/2011 Annex II / FDA FALCPA',
  },
  {
    name: 'Egg & Albumin Allergen',
    pattern: 'egg, eggs, whole eggs, egg white, egg yolk, albumin',
    ruleType: 'allergen',
    allergenType: 'Egg',
    hazardLevel: 'safe',
    fdaStatus: 'FDA Major Allergen (FALCPA)',
    euStatus: 'EU Annex II Mandatory Allergen',
    explanation:
      'Avian egg proteins (ovalbumin/ovomucoid); major childhood and adult food allergen requiring mandatory declaration.',
    source: 'EU Reg 1169/2011 Annex II / FDA FALCPA',
  },
  {
    name: 'Celery Allergen',
    pattern: 'celery, celeriac',
    ruleType: 'allergen',
    allergenType: 'Celery',
    hazardLevel: 'safe',
    fdaStatus: 'Monitored Spice Allergen',
    euStatus: 'EU Annex II Mandatory Allergen',
    explanation:
      'Listed mandatory allergen under EU Annex II; even trace herb/spice extracts containing celery must be clearly declared.',
    source: 'EU Reg 1169/2011 Annex II',
  },
  {
    name: 'Sesame Allergen',
    pattern: 'sesame, tahini',
    ruleType: 'allergen',
    allergenType: 'Sesame',
    hazardLevel: 'safe',
    fdaStatus: 'FDA FASTER Act Major Allergen',
    euStatus: 'EU Annex II Mandatory Allergen',
    explanation:
      '9th US major food allergen under the FASTER Act and mandatory EU Annex II allergen.',
    source: 'FDA FASTER Act / EU Reg 1169/2011',
  },

  // =========================================================
  // 2. BANNED / WARNING CONTAMINANTS & RESTRICTED ADDITIVES
  // =========================================================
  {
    name: 'Ethylene Oxide Contaminant',
    pattern: 'ethylene oxide, eto',
    ruleType: 'additive',
    hazardLevel: 'warning',
    fdaStatus: 'Prohibited Residue >0.05 mg/kg',
    euStatus: 'Banned Fumigant (EU 2015/868)',
    explanation:
      'Genotoxic Class 1 carcinogenic fumigant prohibited in food processing; any detectable residue above statutory MRL triggers immediate quarantine.',
    source: 'EFSA / EU Reg 2015/868 / BFSA',
  },
  {
    name: 'Sudan Red I Industrial Dye',
    pattern: 'sudan red, sudan i, ci 12055',
    ruleType: 'additive',
    additiveCode: 'CI 12055',
    hazardLevel: 'warning',
    fdaStatus: 'Illegal Unapproved Colorant',
    euStatus: 'Banned Genotoxic Azo Dye',
    explanation:
      'Illegal industrial azo dye (CI 12055) linked to carcinogenicity and DNA damage; strictly prohibited in all food formulations.',
    source: 'EFSA / Codex / BFSA Adulteration Notice',
  },
  {
    name: 'Konjac Gum / Flour Mini-Cup Restriction',
    pattern: 'konjac, konjac powder',
    ruleType: 'category_restriction',
    additiveCode: 'E425',
    categoryScope: 'Snacks & Confectionery',
    hazardLevel: 'warning',
    fdaStatus: 'Choking Hazard Alert (Jelly Cups)',
    euStatus: 'Prohibited in Mini Jelly Cups (E425)',
    explanation:
      'Prohibited in gel mini-cup confectionery due to non-dissolving elastic texture causing severe pediatric asphyxiation and choking.',
    source: 'EU Directive 2002/52/EC / Consumer Safety Reg',
  },
  {
    name: 'Azodicarbonamide (ADA)',
    pattern: 'azodicarbonamide, ada, e927a',
    ruleType: 'additive',
    additiveCode: 'E927a',
    hazardLevel: 'warning',
    fdaStatus: '21 CFR 172.806 (Max 45 ppm)',
    euStatus: 'Banned in EU Food (E927a)',
    explanation:
      'Synthetic flour bleaching and dough conditioning agent banned in the EU and Australia due to semicarbazide breakdown concerns.',
    source: 'EFSA / EU Reg 1333/2008',
  },
  {
    name: 'Synthetic Azo Food Dyes (Southampton Six)',
    pattern: 'tartrazine, sunset yellow, allura red, e102, e110, e129',
    ruleType: 'additive',
    additiveCode: 'E102',
    hazardLevel: 'warning',
    fdaStatus: 'FD&C Certified Colorant',
    euStatus: 'EU Warning Label Required',
    explanation:
      'Synthetic petroleum-derived azo dyes requiring mandatory EU warning labels regarding adverse effects on activity and attention in children.',
    source: 'EU Reg 1333/2008 Annex V / EFSA',
  },
  {
    name: 'Sodium Nitrite Curing Agent',
    pattern: 'sodium nitrite, e250',
    ruleType: 'additive',
    additiveCode: 'E250',
    hazardLevel: 'warning',
    fdaStatus: 'FDA Restricted Limit',
    euStatus: 'EFSA Strict ADI (0.07 mg/kg)',
    explanation:
      'Curing preservative used in processed meats; monitored for nitrosamine formation during high-heat cooking.',
    source: 'EFSA ANS Panel / FDA 21 CFR 172.175',
  },

  // =========================================================
  // 3. CAUTION ADDITIVES, PROCESSING AGENTS & CATEGORY RULES
  // =========================================================
  {
    name: 'Caramel Color Class IV (Sulfite-Ammonia)',
    pattern: 'caramel color, caramel colour, e150d',
    ruleType: 'additive',
    additiveCode: 'E150d',
    hazardLevel: 'caution',
    fdaStatus: 'FDA 21 CFR 73.85 (4-MEI Monitored)',
    euStatus: 'EFSA Group ADI 300 mg/kg (E150d)',
    explanation:
      'Class IV sulfite-ammonia processed caramel colorant; monitored internationally for trace 4-methylimidazole (4-MEI) byproduct.',
    source: 'EFSA Panel / California Prop 65 / FDA',
  },
  {
    name: 'Caramel Color Class III (Ammonia)',
    pattern: 'ammonia caramel, caramel color e150c, e150c',
    ruleType: 'additive',
    additiveCode: 'E150c',
    hazardLevel: 'caution',
    fdaStatus: 'FDA 21 CFR 73.85',
    euStatus: 'EFSA Restricted ADI 100 mg/kg (E150c)',
    explanation:
      'Ammonia-process caramel colorant subject to lower EFSA group ADI limits due to THI byproduct monitoring.',
    source: 'EFSA Panel / Codex INS 150c',
  },
  {
    name: 'Phosphoric Acid (Beverage Acidulant)',
    pattern: 'phosphoric acid, e338',
    ruleType: 'category_restriction',
    additiveCode: 'E338',
    categoryScope: 'Beverages',
    hazardLevel: 'caution',
    fdaStatus: 'GRAS 21 CFR 182.1073',
    euStatus: 'EFSA Group ADI 40 mg/kg P (E338)',
    explanation:
      'Inorganic acidulant in carbonated beverages; excessive intake is associated with dental enamel erosion and dietary phosphorus-calcium imbalance.',
    source: 'EFSA Phosphate Re-evaluation / Codex',
  },
  {
    name: 'Sodium Benzoate Preservative',
    pattern: 'sodium benzoate, e211',
    ruleType: 'additive',
    additiveCode: 'E211',
    hazardLevel: 'caution',
    fdaStatus: 'GRAS 21 CFR 184.1733 (Max 0.1%)',
    euStatus: 'EFSA ADI 5 mg/kg bw (E211)',
    explanation:
      'Synthetic antimicrobial preservative; monitored in acidic beverages where combination with ascorbic acid can form trace benzene under heat/light.',
    source: 'EFSA ANS Panel / FDA 21 CFR',
  },
  {
    name: 'Monosodium Glutamate (MSG)',
    pattern: 'monosodium glutamate, msg, e621',
    ruleType: 'additive',
    additiveCode: 'E621',
    hazardLevel: 'caution',
    fdaStatus: 'GRAS (Mandatory Declaration)',
    euStatus: 'EFSA Group ADI 30 mg/kg bw (E621)',
    explanation:
      'Umami flavor enhancer; EFSA established a conservative group ADI for glutamates due to transient neuro-excitatory sensitivity in high doses.',
    source: 'EFSA 2017 Glutamate Re-evaluation',
  },
  {
    name: 'Disodium 5-Ribonucleotides / Inosinate',
    pattern: 'disodium 5-ribonucleotides, disodium inosinate, disodium guanylate, e635, e631',
    ruleType: 'additive',
    additiveCode: 'E635',
    hazardLevel: 'caution',
    fdaStatus: 'FDA Approved Flavor Enhancer',
    euStatus: 'EU Authorized (E635)',
    explanation:
      'Purine-derived umami nucleotide flavor enhancer; caution advised for individuals managing hyperuricemia or gout.',
    source: 'Codex Alimentarius / EU Reg 1333/2008',
  },
  {
    name: 'Caffeine Stimulant in Beverages',
    pattern: 'caffeine',
    ruleType: 'category_restriction',
    categoryScope: 'Beverages',
    hazardLevel: 'caution',
    fdaStatus: 'GRAS (Advisory >200mg/day)',
    euStatus: 'EU High-Caffeine Labelling Required',
    explanation:
      'Central nervous system stimulant; EU/national rules require cautionary labeling advising against consumption by children and pregnant women.',
    source: 'EU Reg 1169/2011 Annex III / EFSA',
  },
  {
    name: 'Calcium Propionate Preservative',
    pattern: 'calcium propionate, e282',
    ruleType: 'additive',
    additiveCode: 'E282',
    hazardLevel: 'caution',
    fdaStatus: 'GRAS 21 CFR 184.1221',
    euStatus: 'EU Authorized Mold Inhibitor (E282)',
    explanation:
      'Synthetic anti-mold preservative commonly used in commercial bakery loaves; flagged as a processing marker in ultra-processed bread.',
    source: 'FDA 21 CFR / EFSA',
  },
  {
    name: 'Mono- and Diglycerides of Fatty Acids',
    pattern: 'monoglycerides and diglycerides, mono- and diglycerides, e471',
    ruleType: 'additive',
    additiveCode: 'E471',
    hazardLevel: 'caution',
    fdaStatus: 'GRAS 21 CFR 184.1505',
    euStatus: 'EFSA Evaluated Emulsifier (E471)',
    explanation:
      'Industrial lipid emulsifier used to extend shelf softness; may derive from plant or animal fats and indicates ultra-processed formulation.',
    source: 'EFSA ANS Panel / Codex INS 471',
  },
  {
    name: 'Sodium Stearoyl Lactylate',
    pattern: 'sodium stearoyl lactylate, e481',
    ruleType: 'additive',
    additiveCode: 'E481',
    hazardLevel: 'caution',
    fdaStatus: 'FDA 21 CFR 172.846',
    euStatus: 'EFSA ADI 22 mg/kg bw (E481)',
    explanation:
      'Synthetic dough strengthener and crumb softener subject to EFSA acceptable daily intake limits.',
    source: 'EFSA / FDA 21 CFR 172.846',
  },
  {
    name: 'Polyglycerol Polyricinoleate (PGPR)',
    pattern: 'e476, polyglycerol polyricinoleate, emulsifiers (e442',
    ruleType: 'additive',
    additiveCode: 'E476',
    hazardLevel: 'caution',
    fdaStatus: 'FDA GRAS Notice',
    euStatus: 'EFSA ADI 25 mg/kg bw (E476)',
    explanation:
      'Synthetic viscosity-reducing emulsifier in chocolate compounds used to substitute cocoa butter; regulated under EFSA ADI limits.',
    source: 'EFSA 2017 Re-evaluation',
  },
  {
    name: 'High Fructose & Glucose-Fructose Syrups',
    pattern: 'high fructose corn syrup, glucose-fructose syrup, inverted sugar syrup',
    ruleType: 'ingredient',
    hazardLevel: 'caution',
    fdaStatus: 'GRAS Sweetener',
    euStatus: 'Monitored Free Sugar Marker',
    explanation:
      'Refined industrial liquid sweetener associated with elevated glycemic load and excessive free-sugar intake when consumed regularly.',
    source: 'WHO Free Sugars Guideline / FDA',
  },
  {
    name: 'Refined Added Sugars',
    pattern: 'refined sugar, sucrose & glucose, sugar',
    ruleType: 'ingredient',
    hazardLevel: 'caution',
    fdaStatus: 'GRAS (Added Sugar Declaration)',
    euStatus: 'WHO Limit (<10% Energy)',
    explanation:
      'Refined free sugar contributing to glycemic spikes and caloric density; WHO recommends limiting free sugars below 10% of daily energy.',
    source: 'WHO Dietary Guidelines / FDA',
  },
  {
    name: 'Refined Palm Oil & Palm Olein',
    pattern: 'palm oil, refined palm oil, palm olein, vegetable fats (palm',
    ruleType: 'ingredient',
    hazardLevel: 'caution',
    fdaStatus: 'Permitted Vegetable Fat',
    euStatus: 'EFSA 3-MCPD / GE Monitored',
    explanation:
      'High saturated-fat tropical oil; high-temperature refining is monitored by EFSA for glycidyl fatty acid esters and sustainability impact.',
    source: 'EFSA CONTAM Panel / Codex',
  },
  {
    name: 'Fully Hydrogenated Vegetable Oils',
    pattern: 'fully hydrogenated, hydrogenated rapeseed',
    ruleType: 'ingredient',
    hazardLevel: 'caution',
    fdaStatus: 'Permitted (0g Trans Target)',
    euStatus: 'Industrial Processing Marker',
    explanation:
      'Chemically saturated industrial fat used for texture stability; marks ultra-processed formulation and elevated saturated lipid intake.',
    source: 'WHO REPLACE / EFSA',
  },

  // =========================================================
  // 4. SAFE / AUTHORIZED ADDITIVES & FORTIFICANTS
  // =========================================================
  {
    name: 'Plain Caramel Color Class I',
    pattern: 'e150a, plain caramel',
    ruleType: 'additive',
    additiveCode: 'E150a',
    hazardLevel: 'safe',
    fdaStatus: 'GRAS 21 CFR 73.85',
    euStatus: 'EU Authorized (E150a)',
    explanation:
      'Class I plain caramel prepared by controlled heating of food carbohydrates without sulfite or ammonia reagents.',
    source: 'EFSA / Codex INS 150a',
  },
  {
    name: 'Potassium & Dipotassium Phosphates',
    pattern: 'dipotassium phosphate, tripotassium phosphate, e340',
    ruleType: 'additive',
    additiveCode: 'E340',
    hazardLevel: 'safe',
    fdaStatus: 'GRAS 21 CFR 182.6285',
    euStatus: 'EU Authorized Buffer (E340)',
    explanation:
      'Mineral acidity regulator buffering plant milk proteins against separation in hot coffee; safe at standard dietary concentrations.',
    source: 'FDA 21 CFR / EFSA E340',
  },
  {
    name: 'Calcium Carbonate Fortificant',
    pattern: 'calcium carbonate, e170',
    ruleType: 'additive',
    additiveCode: 'E170',
    hazardLevel: 'safe',
    fdaStatus: 'GRAS Mineral Fortificant',
    euStatus: 'EU Authorized (E170)',
    explanation:
      'Food-grade mineral calcium salt supplying bioavailable dietary calcium fortification in plant milks and cereals.',
    source: 'FDA GRAS / EFSA E170',
  },
  {
    name: 'Citric Acid Acidity Regulator',
    pattern: 'citric acid, e330',
    ruleType: 'additive',
    additiveCode: 'E330',
    hazardLevel: 'safe',
    fdaStatus: 'GRAS 21 CFR 184.1033',
    euStatus: 'EU Authorized quantum satis (E330)',
    explanation:
      'Naturally occurring weak organic acid widely used for tartness and pH preservation; no numerical ADI limit needed.',
    source: 'JECFA / EFSA E330',
  },
  {
    name: 'Potassium Citrate Buffer',
    pattern: 'potassium citrate, e332',
    ruleType: 'additive',
    additiveCode: 'E332',
    hazardLevel: 'safe',
    fdaStatus: 'GRAS 21 CFR 184.1625',
    euStatus: 'EU Authorized (E332)',
    explanation:
      'Potassium salt of citric acid acting as a gentle acidity buffer and stabilizer in beverages and plant milks.',
    source: 'FDA 21 CFR / EFSA E332',
  },
  {
    name: 'Sunflower / Plant Lecithin Emulsifier',
    pattern: 'sunflower lecithin, lecithin, e322',
    ruleType: 'additive',
    additiveCode: 'E322',
    hazardLevel: 'safe',
    fdaStatus: 'GRAS 21 CFR 184.1400',
    euStatus: 'EU Authorized quantum satis (E322)',
    explanation:
      'Natural phospholipid emulsifier that keeps fats and water blended smoothly without synthetic chemical surfactants.',
    source: 'FDA GRAS / EFSA E322',
  },
  {
    name: 'Gellan Gum Plant Stabilizer',
    pattern: 'gellan gum, e418',
    ruleType: 'additive',
    additiveCode: 'E418',
    hazardLevel: 'safe',
    fdaStatus: 'FDA 21 CFR 172.665',
    euStatus: 'EU Authorized quantum satis (E418)',
    explanation:
      'Microbially fermented plant-compatible polysaccharide stabilizer preventing mineral sedimentation in fortified beverages.',
    source: 'EFSA ANS Panel E418',
  },
  {
    name: 'Beta-Carotene Natural Colorant',
    pattern: 'beta-carotene, beta carotene, e160a',
    ruleType: 'additive',
    additiveCode: 'E160a',
    hazardLevel: 'safe',
    fdaStatus: 'GRAS Provitamin A Color',
    euStatus: 'EU Authorized (E160a)',
    explanation:
      'Natural carotenoid pigment and provitamin A precursor giving orange-yellow hues without synthetic azo dyes.',
    source: 'EFSA / FDA 21 CFR 73.95',
  },
  {
    name: 'Paprika Oleoresin Extract',
    pattern: 'paprika oleoresin, e160c',
    ruleType: 'additive',
    additiveCode: 'E160c',
    hazardLevel: 'safe',
    fdaStatus: 'FDA Exempt Color (21 CFR 73.345)',
    euStatus: 'EU Authorized (E160c)',
    explanation:
      'Botanical extract of Capsicum annuum pods providing natural red-amber color and mild spice aroma.',
    source: 'FDA 21 CFR / EFSA E160c',
  },
  {
    name: 'Ascorbic Acid (Vitamin C)',
    pattern: 'ascorbic acid, vitamin c, e300',
    ruleType: 'additive',
    additiveCode: 'E300',
    hazardLevel: 'safe',
    fdaStatus: 'GRAS Essential Nutrient',
    euStatus: 'EU Authorized Antioxidant (E300)',
    explanation:
      'Essential water-soluble vitamin and natural antioxidant preventing enzymatic browning and oxidative spoilage.',
    source: 'EFSA / FDA 21 CFR 182.3013',
  },
  {
    name: 'Mixed Tocopherols (Vitamin E)',
    pattern: 'tocopherols, vitamin e, e306',
    ruleType: 'additive',
    additiveCode: 'E306',
    hazardLevel: 'safe',
    fdaStatus: 'GRAS Antioxidant',
    euStatus: 'EU Authorized (E306)',
    explanation:
      'Natural lipid-soluble Vitamin E antioxidant protecting healthy unsaturated oils from rancidity.',
    source: 'EFSA / FDA GRAS',
  },
  {
    name: 'Hydroxypropyl Methylcellulose (HPMC)',
    pattern: 'hydroxypropyl methylcellulose, e464',
    ruleType: 'additive',
    additiveCode: 'E464',
    hazardLevel: 'safe',
    fdaStatus: 'FDA Approved Binder',
    euStatus: 'EU Authorized quantum satis (E464)',
    explanation:
      'Plant-cellulose dietary fiber derivative providing gluten-free dough elasticity in specialty bakery products.',
    source: 'EFSA 2018 Re-evaluation',
  },
  {
    name: 'Food-Grade Carbonates & Raising Agents',
    pattern: 'sodium bicarbonate, sodium hydrogen carbonate, ammonium bicarbonate, ammonium hydrogen carbonate, potassium carbonate, sodium carbonate, magnesium carbonate, raising agents, e500, e501, e503, e504',
    ruleType: 'additive',
    additiveCode: 'E500',
    hazardLevel: 'safe',
    fdaStatus: 'GRAS Leavening / pH Salt',
    euStatus: 'EU Authorized quantum satis',
    explanation:
      'Standard mineral carbonate leavening salts and mineral buffers safely used in baking and beverage stabilization.',
    source: 'Codex / EFSA E500–E504',
  },
  {
    name: 'Potassium Chloride Mineral Salt',
    pattern: 'potassium chloride, e508',
    ruleType: 'additive',
    additiveCode: 'E508',
    hazardLevel: 'safe',
    fdaStatus: 'GRAS Sodium Alternative',
    euStatus: 'EU Authorized (E508)',
    explanation:
      'Mineral salt substitute reducing total sodium burden while maintaining savory seasoning profile.',
    source: 'FDA GRAS / EFSA E508',
  },

  // =========================================================
  // 5. RECOGNIZED WHOLESOME BASE INGREDIENTS & BOTANICALS
  // =========================================================
  {
    name: 'Purified / Spring / Carbonated Water',
    pattern: 'water, filtered water, spring water, carbonated water, treated water, alpine spring water',
    ruleType: 'ingredient',
    hazardLevel: 'safe',
    fdaStatus: 'Potable Food Base',
    euStatus: 'EU Drinking Water Std',
    explanation:
      'Clean potable hydration base free of synthetic additives or caloric load.',
    source: 'WHO / BSTI Drinking Water Standard',
  },
  {
    name: 'Cultured Probiotic & Sourdough Cultures',
    pattern: 'probiotic cultures, sourdough starter, lactobacillus, yeast, fresh yeast',
    ruleType: 'ingredient',
    hazardLevel: 'safe',
    fdaStatus: 'GRAS Fermentation Culture',
    euStatus: 'EFSA QPS Qualified',
    explanation:
      'Beneficial food-grade fermentation microorganisms supporting natural leavening, digestibility, or probiotic gut balance.',
    source: 'EFSA QPS List / FDA GRAS',
  },
  {
    name: 'Dietary Salt & Iodised Sea Salt',
    pattern: 'sea salt, grey celtic sea salt, iodised salt, salt',
    ruleType: 'ingredient',
    hazardLevel: 'safe',
    fdaStatus: 'GRAS Culinary Mineral',
    euStatus: 'Authorized Food Ingredient',
    explanation:
      'Essential sodium chloride seasoning (often fortified with potassium iodide for thyroid health); monitor total daily sodium.',
    source: 'WHO / BSTI Salt Standard',
  },
  {
    name: 'Culinary Cold-Pressed & Vegetable Oils',
    pattern: 'rapeseed oil, olive oil, extra virgin olive oil, sunflower, corn, and/or canola oil',
    ruleType: 'ingredient',
    hazardLevel: 'safe',
    fdaStatus: 'GRAS Culinary Lipid',
    euStatus: 'Codex Vegetable Oil Std',
    explanation:
      'Plant-derived culinary oil rich in unsaturated fatty acids without industrial hydrogenation.',
    source: 'Codex STAN 210',
  },
  {
    name: 'Botanical Tea, Cocoa & Honey',
    pattern: 'green tea leaves, camellia sinensis, cocoa powder, fat-reduced cocoa, cocoa butter, cocoa mass, honey, molasses',
    ruleType: 'ingredient',
    hazardLevel: 'safe',
    fdaStatus: 'GRAS Whole Botanical',
    euStatus: 'EU Verified Foodstuff',
    explanation:
      'Minimally processed botanical ingredient supplying natural polyphenols, flavor, or unrefined sweetness.',
    source: 'Codex Alimentarius',
  },
  {
    name: 'Whole Fruits, Vegetables, Legumes & Seeds',
    pattern: 'mango pulp, tomatoes, tomato puree, zucchini, spinach, raisins, lentils, red kidney beans, chickpeas, buckwheat, millet, rice flour, rice starch, potato, tapioca, psyllium, flax seeds, sunflower seeds, chicory root fiber, taurine, potassium iodide, vitamin d2, vitamins',
    ruleType: 'ingredient',
    hazardLevel: 'safe',
    fdaStatus: 'Whole Food / Nutrient',
    euStatus: 'EU Verified Foodstuff',
    explanation:
      'Wholesome plant produce, pulse protein, grain flour, or micronutrient fortificant supporting clean-label nutrition.',
    source: 'USDA / Codex Alimentarius',
  },
  {
    name: 'Natural Culinary Herbs & Spices',
    pattern: 'turmeric, cumin, coriander, chili, chilli, habanero, clove, nutmeg, basil, garlic, ginger, garam masala, spicy masala seasoning, tastemaker spice, spirit vinegar',
    ruleType: 'ingredient',
    hazardLevel: 'safe',
    fdaStatus: 'GRAS Culinary Spice',
    euStatus: 'EU Verified Spice / Condiment',
    explanation:
      'Traditional culinary herb, spice, or fermented vinegar ingredient; recognized natural seasoning.',
    source: 'Codex / FDA 21 CFR 182.10',
  },
  {
    name: 'Unrefined Starch & Thickener Bases',
    pattern: 'corn starch, potato starch, modified tapioca starch, fruit sugar',
    ruleType: 'ingredient',
    hazardLevel: 'safe',
    fdaStatus: 'GRAS Food Starch',
    euStatus: 'EU Verified Foodstuff',
    explanation:
      'Plant-derived carbohydrate thickener or minor fruit sugar fraction evaluated as standard food ingredient.',
    source: 'Codex Alimentarius / FDA',
  },
];
