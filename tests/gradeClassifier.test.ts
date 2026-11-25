import { describe, expect, it } from 'vitest';
import { classifyVerdict } from '../src/domain/gradeClassifier';

describe('classifyVerdict', () => {
  it('classifies authentic rulings into sahih and sahih_isnad accurately', () => {
    expect(classifyVerdict('[صحيح]').bucket).toBe('sahih');
    expect(classifyVerdict('أخرجه في صحيحه').bucket).toBe('sahih');
    expect(classifyVerdict('صحيح متواتر').bucket).toBe('sahih');
    expect(classifyVerdict('صحيح لغيره').bucket).toBe('sahih');
    expect(classifyVerdict('حسن صحيح').bucket).toBe('sahih');

    expect(classifyVerdict('إسناده صحيح على شرط الشيخين').bucket).toBe('sahih_isnad');
    expect(classifyVerdict('إسناده صحيح عن عمر بن الخطاب').bucket).toBe('sahih_isnad');
    expect(classifyVerdict('صحيح الإسناد').bucket).toBe('sahih_isnad');
    expect(classifyVerdict('[إسناده صحيح أو حسن أو ما قاربهما]').bucket).toBe('sahih_isnad');
  });

  it('classifies hasan rulings into hasan and hasan_isnad accurately', () => {
    expect(classifyVerdict('حسن').bucket).toBe('hasan');
    expect(classifyVerdict('حسن غريب').bucket).toBe('hasan');
    expect(classifyVerdict('لا بأس به').bucket).toBe('hasan');

    expect(classifyVerdict('إسناده حسن').bucket).toBe('hasan_isnad');
    expect(classifyVerdict('إسناده جيد').bucket).toBe('hasan_isnad');
    expect(classifyVerdict('إسناد قوي').bucket).toBe('hasan_isnad');
  });

  it('classifies ordinary weak, weak-chain, and negated-authentic rulings accurately', () => {
    expect(classifyVerdict('ضعيف').bucket).toBe('daif');
    expect(classifyVerdict('إسناده ضعيف').bucket).toBe('daif_isnad');
    expect(classifyVerdict('ضعيف الإسناد').bucket).toBe('daif_isnad');
    expect(classifyVerdict('ليس بصحيح').bucket).toBe('daif');
    expect(classifyVerdict('لا يصح عن النبي').bucket).toBe('daif');
    expect(classifyVerdict('غير محفوظ').bucket).toBe('daif');
    expect(classifyVerdict('لم يثبت').bucket).toBe('daif');
    expect(classifyVerdict('مرسل').bucket).toBe('daif');
    expect(classifyVerdict('شاذ').bucket).toBe('daif');
    expect(classifyVerdict('ضعيف وليس بموضوع').bucket).toBe('daif');
    expect(classifyVerdict('[فيه] سليمان بن قرم لا شيء في الحديث').bucket).toBe('daif');
    expect(classifyVerdict('[فيه] فلان ليس بشيء').bucket).toBe('daif');
    expect(classifyVerdict('فيه خطأ').bucket).toBe('daif');
  });

  it('never misclassifies negated positive verdicts or negated chains as sahih or hasan (Issue #1)', () => {
    expect(classifyVerdict('ليس بثابت').bucket).toBe('daif');
    expect(classifyVerdict('غير ثابت').bucket).toBe('daif');
    expect(classifyVerdict('ليس بالثابت').bucket).toBe('daif');
    expect(classifyVerdict('ليست بثابتة').bucket).toBe('daif');
    expect(classifyVerdict('ليس بالقوي').bucket).toBe('daif');
    expect(classifyVerdict('ليس بقوي').bucket).toBe('daif');
    expect(classifyVerdict('غير قوي').bucket).toBe('daif');
    expect(classifyVerdict('ليس بحسن').bucket).toBe('daif');
    expect(classifyVerdict('غير حسن').bucket).toBe('daif');
    expect(classifyVerdict('ليس بجيد').bucket).toBe('daif');
    expect(classifyVerdict('غير جيد').bucket).toBe('daif');
    expect(classifyVerdict('ليس بصالح').bucket).toBe('daif');
    expect(classifyVerdict('غير صالح').bucket).toBe('daif');
    expect(classifyVerdict('غير مقبول').bucket).toBe('daif');
    expect(classifyVerdict('ليس بمقبول').bucket).toBe('daif');
    expect(classifyVerdict('لا يقوى').bucket).toBe('daif');
    expect(classifyVerdict('لا يحسن').bucket).toBe('daif');

    // Negated isnad/chain forms must map accurately to daif_isnad
    expect(classifyVerdict('إسناده ليس بالقوي').bucket).toBe('daif_isnad');
    expect(classifyVerdict('إسناده ليس بقوي').bucket).toBe('daif_isnad');
    expect(classifyVerdict('إسناده غير قوي').bucket).toBe('daif_isnad');
    expect(classifyVerdict('إسناده ليس بثابت').bucket).toBe('daif_isnad');
    expect(classifyVerdict('إسناده لم يثبت').bucket).toBe('daif_isnad');
    expect(classifyVerdict('إسناده ليس بحسن').bucket).toBe('daif_isnad');
    expect(classifyVerdict('إسناده ليس بجيد').bucket).toBe('daif_isnad');
    expect(classifyVerdict('سنده ليس بالقوي').bucket).toBe('daif_isnad');
    expect(classifyVerdict('سنده غير صحيح').bucket).toBe('daif_isnad');

    // Non-grading exclusion notes must not trigger SAHIH_PATTERN
    expect(classifyVerdict('ليس على شرط الشيخين').bucket).toBe('unknown');
    expect(classifyVerdict('ليس في الصحيحين').bucket).toBe('unknown');
    expect(classifyVerdict('لم يخرجاه في الصحيحين').bucket).toBe('unknown');

    // Genuine positive verdicts paired with an exclusion note keep their positive grade
    expect(classifyVerdict('صحيح الإسناد ولم يخرجاه في الصحيحين').bucket).toBe('sahih_isnad');
    expect(classifyVerdict('حسن وليس بضعيف').bucket).toBe('hasan');

    // Compound negated + corroborated verdict stays unknown (detailed ruling)
    expect(classifyVerdict('ليس بثابت ولكن له شاهد').bucket).toBe('unknown');
  });

  it('classifies severely weak rulings as very_weak', () => {
    expect(classifyVerdict('ضعيف جداً').bucket).toBe('very_weak');
    expect(classifyVerdict('ضعيف جدا').bucket).toBe('very_weak');
    expect(classifyVerdict('ضعيف واهٍ باتفاق أهل الحديث').bucket).toBe('very_weak');
    expect(classifyVerdict('[فيه] عمرو بن شمر متروك الحديث').bucket).toBe('very_weak');
    expect(classifyVerdict('ساقط الإسناد').bucket).toBe('very_weak');
    expect(classifyVerdict('[ لا يتطرق إليه احتمال التحسين]').bucket).toBe('very_weak');
  });

  it('classifies munkar rulings as munkar', () => {
    expect(classifyVerdict('منكر').bucket).toBe('munkar');
    expect(classifyVerdict('منكر جدًا').bucket).toBe('munkar');
    expect(classifyVerdict('حديث منكر ضعيف').bucket).toBe('munkar');
  });

  it('classifies fabricated rulings as mawdu', () => {
    expect(classifyVerdict('موضوع').bucket).toBe('mawdu');
    expect(classifyVerdict('حديث مكذوب').bucket).toBe('mawdu');
    expect(classifyVerdict('كذب مختلق').bucket).toBe('mawdu');
  });

  it('classifies baseless rulings as batil', () => {
    expect(classifyVerdict('باطل لا يصح له إسناد').bucket).toBe('batil');
    expect(classifyVerdict('لا أصل له').bucket).toBe('batil');
    expect(classifyVerdict('لا أعرف له أصلا').bucket).toBe('batil');
    expect(classifyVerdict('لا أعرف له أصلاً').bucket).toBe('batil');
    expect(classifyVerdict('لا يعلم له أصل').bucket).toBe('batil');
    expect(classifyVerdict('باطل').bucket).toBe('batil');
  });

  it('classifies compound/split verdicts and descriptive notes as unknown while preserving rawVerdict', () => {
    const splitVerdict = 'ضعيف والشطر الثاني صحيح [لغيره]';
    expect(classifyVerdict(splitVerdict)).toEqual({
      bucket: 'unknown',
      rawVerdict: splitVerdict,
    });

    const corroboratedSplit = 'إسناده ضعيف لكن للشطر الثاني منه شاهدان يقويانه';
    expect(classifyVerdict(corroboratedSplit)).toEqual({
      bucket: 'unknown',
      rawVerdict: corroboratedSplit,
    });

    const suspendedNarratorNote =
      'رواته ثقات إلا أن أبا الخطاب الدمشقي لا تحضرني الآن ترجمته';
    expect(classifyVerdict(suspendedNarratorNote)).toEqual({
      bucket: 'unknown',
      rawVerdict: suspendedNarratorNote,
    });

    const descriptive =
      'أورده في المختارة وقال [هذه أحاديث اخترتها مما ليس في البخاري ومسلم]';
    expect(classifyVerdict(descriptive)).toEqual({
      bucket: 'unknown',
      rawVerdict: descriptive,
    });
  });
});
