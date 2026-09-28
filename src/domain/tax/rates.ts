/**
 * 額面推定に使う税率・控除額のテーブル（年分ごと）
 *
 * このアプリは口座に入った金額（＝手取り）しか記録しないため、
 * 年収の額面は税・社会保険料から逆算する。その計算に必要な数値を
 * すべてこのファイルに集約する。
 *
 * 【運用】料率が改定されたらこのファイルだけを更新すればよい。
 * 新しい年分を TAX_YEARS に足し、LATEST_TAX_YEAR を上げる。
 *
 * 【前提】協会けんぽ（全国平均）・一般の事業・40歳未満・扶養なし。
 * 実際の負担は都道府県や健保組合、扶養状況で変わるため、あくまで概算。
 */

/** 社会保険料率（すべて本人負担分） */
export interface SocialInsuranceRates {
  /** 健康保険 */
  health: number;
  /** 介護保険（40〜64歳のみ。既定では加算しない） */
  longTermCare: number;
  /** 子ども・子育て支援金（令和8年度から。それ以前は 0） */
  childcareSupport: number;
  /** 厚生年金 */
  pension: number;
  /** 雇用保険 */
  employment: number;
}

/**
 * 段階的な控除額の1区分。
 * 控除額 = 金額 × rate + constant（rate が 0 なら constant がそのまま定額）
 */
export interface DeductionTier {
  /** この金額以下なら当区分を適用 */
  upTo: number;
  rate: number;
  constant: number;
}

/** 合計所得金額の区分ごとの定額控除 */
export interface FlatDeductionTier {
  upTo: number;
  amount: number;
}

export interface TaxYearRates {
  socialInsurance: SocialInsuranceRates;
  /** 給与所得控除の速算表 */
  salaryDeduction: readonly DeductionTier[];
  /** 所得税の基礎控除（合計所得金額で決まる） */
  basicDeduction: readonly FlatDeductionTier[];
}

/** 標準報酬月額の上限を年額に直したもの（賞与の別枠上限は考慮しない概算） */
export const HEALTH_INSURANCE_ANNUAL_CAP = 1_390_000 * 12;
export const PENSION_ANNUAL_CAP = 650_000 * 12;

/** 復興特別所得税（所得税額の2.1%上乗せ。2037年分まで） */
export const RECONSTRUCTION_SURTAX_RATE = 0.021;

/** 住民税の所得割の税率（市区町村民税6% + 道府県民税4%） */
export const RESIDENT_TAX_RATE = 0.1;
/** 住民税の基礎控除。所得税と違い改正されておらず据え置き */
export const RESIDENT_TAX_BASIC_DEDUCTION = 430_000;
/** 住民税の均等割 + 森林環境税（年額・自治体差は無視） */
export const RESIDENT_TAX_PER_CAPITA = 5_000;

/**
 * 所得税の速算表（課税所得 → 税率と控除額）。
 * 税額 = 課税所得 × rate − constant
 */
export const INCOME_TAX_BRACKETS: readonly DeductionTier[] = [
  { upTo: 1_949_000, rate: 0.05, constant: 0 },
  { upTo: 3_299_000, rate: 0.1, constant: 97_500 },
  { upTo: 6_949_000, rate: 0.2, constant: 427_500 },
  { upTo: 8_999_000, rate: 0.23, constant: 636_000 },
  { upTo: 17_999_000, rate: 0.33, constant: 1_536_000 },
  { upTo: 39_999_000, rate: 0.4, constant: 2_796_000 },
  { upTo: Infinity, rate: 0.45, constant: 4_796_000 },
];

/** 給与所得控除のうち、190万円超の部分（令和6年分以降は共通） */
const SALARY_DEDUCTION_UPPER_TIERS: readonly DeductionTier[] = [
  { upTo: 3_600_000, rate: 0.3, constant: 80_000 },
  { upTo: 6_600_000, rate: 0.2, constant: 440_000 },
  { upTo: 8_500_000, rate: 0.1, constant: 1_100_000 },
  { upTo: Infinity, rate: 0, constant: 1_950_000 },
];

/** 基礎控除のうち、高所得者側の逓減部分（全年分で共通） */
const BASIC_DEDUCTION_PHASE_OUT: readonly FlatDeductionTier[] = [
  { upTo: 24_000_000, amount: 480_000 },
  { upTo: 24_500_000, amount: 320_000 },
  { upTo: 25_000_000, amount: 160_000 },
  { upTo: Infinity, amount: 0 },
];

/**
 * 年分ごとの料率・控除。
 * EARLIEST 未満の年は EARLIEST の、LATEST 超の年は LATEST の値を使う。
 */
const TAX_YEARS: Record<number, TaxYearRates> = {
  // 令和6年分（2024年）以前
  2024: {
    socialInsurance: {
      health: 0.05,
      longTermCare: 0.008,
      childcareSupport: 0,
      pension: 0.0915,
      employment: 0.006,
    },
    salaryDeduction: [
      { upTo: 1_625_000, rate: 0, constant: 550_000 },
      { upTo: 1_800_000, rate: 0.4, constant: -100_000 },
      ...SALARY_DEDUCTION_UPPER_TIERS,
    ],
    basicDeduction: BASIC_DEDUCTION_PHASE_OUT,
  },

  // 令和7年分（2025年）: 「年収の壁」改正で給与所得控除の最低保障が65万、
  // 基礎控除に所得に応じた上乗せが入った
  2025: {
    socialInsurance: {
      health: 0.05,
      longTermCare: 0.00795,
      childcareSupport: 0,
      pension: 0.0915,
      employment: 0.0055,
    },
    salaryDeduction: [
      { upTo: 1_900_000, rate: 0, constant: 650_000 },
      ...SALARY_DEDUCTION_UPPER_TIERS,
    ],
    basicDeduction: [
      { upTo: 1_320_000, amount: 950_000 },
      { upTo: 3_360_000, amount: 880_000 },
      { upTo: 4_890_000, amount: 680_000 },
      { upTo: 6_550_000, amount: 630_000 },
      { upTo: 23_500_000, amount: 580_000 },
      ...BASIC_DEDUCTION_PHASE_OUT,
    ],
  },

  // 令和8年分（2026年）: 基礎控除の本則が62万に上がり、上乗せも拡充されて
  // 合計所得489万円以下は一律104万。給与所得控除の最低保障は74万（令和8・9年分の特例）。
  // 健康保険料率が34年ぶりに引き下げられ、子ども・子育て支援金の徴収が始まった。
  2026: {
    socialInsurance: {
      health: 0.0495,
      longTermCare: 0.0081,
      childcareSupport: 0.00115,
      pension: 0.0915,
      employment: 0.005,
    },
    salaryDeduction: [
      { upTo: 2_200_000, rate: 0, constant: 740_000 },
      ...SALARY_DEDUCTION_UPPER_TIERS,
    ],
    basicDeduction: [
      { upTo: 4_890_000, amount: 1_040_000 },
      { upTo: 6_550_000, amount: 670_000 },
      { upTo: 23_500_000, amount: 620_000 },
      ...BASIC_DEDUCTION_PHASE_OUT,
    ],
  },
};

export const EARLIEST_TAX_YEAR = 2024;
export const LATEST_TAX_YEAR = 2026;

/** 指定年に適用する料率を返す。範囲外の年は最も近い年で代用する */
export const getTaxYearRates = (year: number): TaxYearRates => {
  const clamped = Math.min(Math.max(year, EARLIEST_TAX_YEAR), LATEST_TAX_YEAR);
  return TAX_YEARS[clamped] ?? TAX_YEARS[LATEST_TAX_YEAR];
};
