/**
 * Türkiye maaş hesabı — brüt → net.
 *
 * 2026 yılı yaklaşık oranlar:
 *   - SGK işçi:       brüt × 14%
 *   - İşsizlik işçi:  brüt × 1%
 *   - Gelir vergisi:  kademeli (15% / 20% / 27% / 35% / 40%)
 *   - Damga vergisi:  brüt × 0.759%
 *   - AGİ:            asgari ücret tabanlı + medeni hal/çocuk
 *   - SGK işveren:    brüt × 15.5%
 *   - İşsizlik işveren: brüt × 2%
 *
 * Gerçekçi hesap için Maliye Bakanlığı'nın güncel tarife + tavanlarına bakılmalı.
 * MVP için 2026 başlangıç oranları sabit kodlanmış — sonra config tablosuna taşınır.
 */

export interface PayrollInput {
  gross_monthly: number;
  marital_status: 'single' | 'married' | string;
  kids_count: number;
  spouse_working: boolean;
  /** Yıl içinde kümülatif gelir vergisi matrahı (önceki ayların toplamı). MVP'de 0 varsayılır */
  cumulative_tax_base?: number;
  additions?: number;
  deductions?: number;
}

export interface PayrollOutput {
  gross: number;
  sgk_employee: number;
  unemployment_employee: number;
  income_tax: number;
  stamp_tax: number;
  agi: number;
  additions: number;
  deductions: number;
  net: number;
  sgk_employer: number;
  unemployment_employer: number;
  total_employer_cost: number;
  breakdown: {
    sgk_base: number;
    income_tax_base: number;
    income_tax_bracket: string;
  };
}

// 2026 Türkiye oranları (yaklaşık başlangıç — yasal güncelleme gerekirse buradan)
const RATES = {
  sgk_employee: 0.14,
  unemployment_employee: 0.01,
  stamp_tax: 0.00759,
  sgk_employer: 0.155,
  unemployment_employer: 0.02,
};

/**
 * Gelir vergisi kademe tablosu (yıllık matrah, 2025-26 yaklaşık).
 * Aylık matrah × 12 ≈ yıllık matrah; basitleştirme için aylık tarife.
 */
const INCOME_TAX_BRACKETS: Array<{ upTo: number; rate: number; label: string }> = [
  { upTo: 158_000, rate: 0.15, label: '%15' },
  { upTo: 330_000, rate: 0.2, label: '%20' },
  { upTo: 1_200_000, rate: 0.27, label: '%27' },
  { upTo: 4_300_000, rate: 0.35, label: '%35' },
  { upTo: Infinity, rate: 0.4, label: '%40' },
];

/**
 * 2026 yılı AGİ tahmini (Asgari geçim indirimi yıl başında belirleniyor).
 * Aylık değer × medeni hal/çocuk katsayıları:
 *   bekar:        %50
 *   evli + eş çalışmıyor: +%10
 *   her çocuk:    +%7.5 (ilk 2 için %7.5, sonraki için %5)
 *
 * Asgari ücret 2026 yaklaşık 22500 TL → AGİ tabanı asgari ücretin %50'sinin %15'i
 */
const MIN_WAGE_2026 = 22_500;
const AGI_BASE_RATE = 0.5 * 0.15; // 1687.5

function calculateAGI(maritalStatus: string, kidsCount: number, spouseWorking: boolean): number {
  let coefficient = 1.0;
  if (maritalStatus === 'married' && !spouseWorking) coefficient += 0.1;
  for (let i = 0; i < kidsCount; i++) {
    if (i < 2) coefficient += 0.075;
    else coefficient += 0.05;
  }
  return Math.round(MIN_WAGE_2026 * AGI_BASE_RATE * coefficient * 100) / 100;
}

export function calculatePayroll(input: PayrollInput): PayrollOutput {
  const gross = Number(input.gross_monthly) || 0;
  const additions = Number(input.additions ?? 0);
  const deductions = Number(input.deductions ?? 0);

  // SGK + İşsizlik (işçi)
  const sgkEmployee = gross * RATES.sgk_employee;
  const unemploymentEmployee = gross * RATES.unemployment_employee;

  // Gelir vergisi matrahı = brüt - sgk işçi - işsizlik işçi
  const incomeTaxBase = gross - sgkEmployee - unemploymentEmployee;

  // Kademe gelir vergisi (basit: tek ay matrahı üzerinden)
  let incomeTax = 0;
  let lower = 0;
  let bracket = INCOME_TAX_BRACKETS[0]!;
  for (const b of INCOME_TAX_BRACKETS) {
    const slice = Math.max(0, Math.min(incomeTaxBase, b.upTo) - lower);
    incomeTax += slice * b.rate;
    if (incomeTaxBase <= b.upTo) {
      bracket = b;
      break;
    }
    lower = b.upTo;
  }

  // Damga vergisi
  const stampTax = gross * RATES.stamp_tax;

  // AGİ
  const agi = calculateAGI(input.marital_status, Number(input.kids_count) || 0, input.spouse_working);

  // Net
  const net = gross - sgkEmployee - unemploymentEmployee - incomeTax - stampTax + agi + additions - deductions;

  // İşveren
  const sgkEmployer = gross * RATES.sgk_employer;
  const unemploymentEmployer = gross * RATES.unemployment_employer;
  const totalEmployerCost = gross + sgkEmployer + unemploymentEmployer;

  return {
    gross: Math.round(gross * 100) / 100,
    sgk_employee: Math.round(sgkEmployee * 100) / 100,
    unemployment_employee: Math.round(unemploymentEmployee * 100) / 100,
    income_tax: Math.round(incomeTax * 100) / 100,
    stamp_tax: Math.round(stampTax * 100) / 100,
    agi: Math.round(agi * 100) / 100,
    additions: Math.round(additions * 100) / 100,
    deductions: Math.round(deductions * 100) / 100,
    net: Math.round(net * 100) / 100,
    sgk_employer: Math.round(sgkEmployer * 100) / 100,
    unemployment_employer: Math.round(unemploymentEmployer * 100) / 100,
    total_employer_cost: Math.round(totalEmployerCost * 100) / 100,
    breakdown: {
      sgk_base: Math.round(gross * 100) / 100,
      income_tax_base: Math.round(incomeTaxBase * 100) / 100,
      income_tax_bracket: bracket.label,
    },
  };
}
