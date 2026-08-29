/**
 * 手取り年収から額面年収を推定する
 *
 * アプリが記録しているのは口座に入った金額（＝手取り）だけなので、
 * 「額面 → 手取り」を計算する関数を作り、それを二分探索で反転させて額面を求める。
 *
 * 【あくまで概算】以下は考慮していない:
 * - 介護保険（40歳以上。オプションで加算できる）
 * - 扶養控除・配偶者控除・生命保険料控除・住宅ローン控除・iDeCo・ふるさと納税
 * - 財形貯蓄・社宅費・組合費などの給与天引き
 * - 賞与と月給で社会保険の上限計算が異なる点（年額に一律の料率をかけている）
 * - 住民税は本来「前年の所得」に対する課税だが、同じ年の所得で計算している
 *   （毎年の収入が大きく変わらない前提の定常状態近似）
 *
 * 料率と控除額は年分ごとに違う。数値は utils/tax/rates.ts を参照。
 */
import {
  DeductionTier,
  HEALTH_INSURANCE_ANNUAL_CAP,
  INCOME_TAX_BRACKETS,
  PENSION_ANNUAL_CAP,
  RECONSTRUCTION_SURTAX_RATE,
  RESIDENT_TAX_BASIC_DEDUCTION,
  RESIDENT_TAX_PER_CAPITA,
  RESIDENT_TAX_RATE,
  getTaxYearRates,
} from './rates';

export interface GrossEstimate {
  /** 推定した額面年収 */
  gross: number;
  /** 元にした手取り年収 */
  net: number;
  /** 健康保険 + 厚生年金 + 雇用保険（+ 子ども子育て支援金 + 任意で介護保険） */
  socialInsurance: number;
  /** 所得税（復興特別所得税込み） */
  incomeTax: number;
  /** 住民税（均等割込み） */
  residentTax: number;
}

export interface GrossEstimateOptions {
  /** 40歳以上（介護保険料を加算する）。既定は false */
  includeLongTermCare?: boolean;
}

/** 住民税の均等割がかかる下限（単身者の非課税限度額の目安） */
const RESIDENT_TAX_PER_CAPITA_THRESHOLD = 450_000;

/** 課税標準は1,000円未満を切り捨てる */
const floorToThousand = (value: number): number => Math.floor(value / 1000) * 1000;

/** 段階表から該当区分を引き、金額 × rate + constant を返す */
const applyTiers = (amount: number, tiers: readonly DeductionTier[]): number => {
  const tier = tiers.find((t) => amount <= t.upTo) ?? tiers[tiers.length - 1];
  return amount * tier.rate + tier.constant;
};

/** 額面年収から手取り年収を計算する（単調増加。逆算の土台になる） */
export const calculateNetFromGross = (
  gross: number,
  year: number,
  options: GrossEstimateOptions = {}
): GrossEstimate => {
  if (gross <= 0) {
    return { gross: 0, net: 0, socialInsurance: 0, incomeTax: 0, residentTax: 0 };
  }

  const { socialInsurance: rates, salaryDeduction, basicDeduction } = getTaxYearRates(year);

  // 社会保険料。健康保険と厚生年金は標準報酬の上限で頭打ちになる
  const healthBase = Math.min(gross, HEALTH_INSURANCE_ANNUAL_CAP);
  const pensionBase = Math.min(gross, PENSION_ANNUAL_CAP);
  const healthRate =
    rates.health + rates.childcareSupport + (options.includeLongTermCare ? rates.longTermCare : 0);
  const socialInsurance = Math.round(
    healthBase * healthRate + pensionBase * rates.pension + gross * rates.employment
  );

  // 給与所得 = 額面 − 給与所得控除
  const employmentIncome = Math.max(0, gross - applyTiers(gross, salaryDeduction));

  // 所得税。給与以外の所得は無いものとして合計所得金額 = 給与所得とする
  const basic =
    (basicDeduction.find((t) => employmentIncome <= t.upTo) ??
      basicDeduction[basicDeduction.length - 1]).amount;
  const taxableIncome = floorToThousand(
    Math.max(0, employmentIncome - socialInsurance - basic)
  );
  const bracket =
    INCOME_TAX_BRACKETS.find((b) => taxableIncome <= b.upTo) ??
    INCOME_TAX_BRACKETS[INCOME_TAX_BRACKETS.length - 1];
  const baseIncomeTax = Math.max(0, taxableIncome * bracket.rate - bracket.constant);
  const incomeTax = Math.floor((baseIncomeTax * (1 + RECONSTRUCTION_SURTAX_RATE)) / 100) * 100;

  // 住民税。基礎控除が所得税と違う（43万で据え置き）ので別に計算する
  const residentTaxable = floorToThousand(
    Math.max(0, employmentIncome - socialInsurance - RESIDENT_TAX_BASIC_DEDUCTION)
  );
  const perCapita =
    employmentIncome > RESIDENT_TAX_PER_CAPITA_THRESHOLD ? RESIDENT_TAX_PER_CAPITA : 0;
  const residentTax = Math.floor((residentTaxable * RESIDENT_TAX_RATE) / 100) * 100 + perCapita;

  return {
    gross,
    net: gross - socialInsurance - incomeTax - residentTax,
    socialInsurance,
    incomeTax,
    residentTax,
  };
};

/**
 * 二分探索の反復回数。
 * 税額の100円未満切り捨てと住民税均等割の段差があるため、税制上の不連続点の
 * 近くでは数千円ずれることがある（年収100万円前後のみ）。実用上は問題ない。
 */
const SEARCH_ITERATIONS = 60;

/**
 * 手取り年収から額面年収を推定する。
 * calculateNetFromGross を二分探索で反転させる。
 */
export const estimateGrossFromNet = (
  net: number,
  year: number,
  options: GrossEstimateOptions = {}
): GrossEstimate => {
  if (net <= 0) {
    return { gross: 0, net: 0, socialInsurance: 0, incomeTax: 0, residentTax: 0 };
  }

  // 最高税率でも手取りは額面の4割を下回らないため、上限は手取りの3倍あれば必ず足りる
  let low = net;
  let high = net * 3;

  for (let i = 0; i < SEARCH_ITERATIONS; i++) {
    const mid = (low + high) / 2;
    if (calculateNetFromGross(mid, year, options).net < net) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const { socialInsurance, incomeTax, residentTax } = calculateNetFromGross(
    Math.round(high),
    year,
    options
  );

  // 積み上げグラフの各段の合計が額面と必ず一致するよう、
  // 探索結果そのものではなく「手取り + 控除」を額面とする（差は数円）
  return {
    gross: net + socialInsurance + incomeTax + residentTax,
    net,
    socialInsurance,
    incomeTax,
    residentTax,
  };
};
