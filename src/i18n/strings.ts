import type { FilterMode, GradeBucket, Locale, ReadingScale, ThemePreference } from '../domain/hadith';

export interface GradeDefinition {
  quote?: string;
  source?: string;
  summary: string;
}

export interface AppStrings {
  appName: string;
  appSubtitle: string;
  searchPlaceholder: string;
  searchButton: string;
  clearSearch: string;
  filtersLabel: string;
  filters: Record<FilterMode, string>;
  grades: Record<GradeBucket, string>;
  gradeDefinitions: Record<GradeBucket, GradeDefinition>;
  gradeHelpAria: (gradeLabel: string) => string;
  gradeHintPrompt: string;
  dismissHint: string;
  otherRulingsLabel: (count: number) => string;
  narratorLabel: string;
  narratorPrefix: string;
  muhaddithLabel: string;
  sourceLabel: string;
  takhrijLabel: string;
  verdictLabel: string;
  verdictByPrefix: string;
  osoulButton: string;
  osoulTitle: string;
  altSahihButton: string;
  altSahihTitle: string;
  similarButton: string;
  similarTitle: string;
  panelLoading: string;
  panelEmpty: string;
  panelError: string;
  copy: string;
  copied: string;
  share: string;
  sharedCopiedFallback: string;
  showMoreMatn: string;
  showLessMatn: string;
  matchBelowPreview: string;
  loadMore: string;
  loadingMore: string;
  endOfResults: string;
  resultsCount: (count: number, hasMore: boolean) => string;
  correctedBanner: (effective: string, original: string) => string;
  relaxedBanner: (effective: string, original: string) => string;
  conceptBanner: (effective: string, original: string) => string;
  searchExactInstead: (original: string) => string;
  didYouMean: string;
  recentSearches: string;
  clearRecent: string;
  tryExamples: string;
  emptyHeading: string;
  emptyBody: string;
  noResultsHeading: string;
  noResultsBody: string;
  errorHeading: string;
  errorBody: string;
  retry: string;
  settingsTitle: string;
  settingsButtonLabel: string;
  close: string;
  languageSection: string;
  themeSection: string;
  themes: Record<ThemePreference, string>;
  systemCurrentlyLight: string;
  systemCurrentlyDark: string;
  readingSizeSection: string;
  readingSizes: Record<ReadingScale, string>;
  aboutSection: string;
  aboutCredit: string;
  aboutVersion: string;
  updateAvailableTitle: (version: string) => string;
  updateAvailableHint: string;
  downloadUpdate: string;
  dismissUpdate: string;
  checkForUpdates: string;
  checkingForUpdates: string;
  upToDate: string;
  updateCheckFailed: string;
  switchLangLabel: string;
  switchLangShort: string;
  desktopQuickSearch: string;
  desktopPin: string;
  desktopUnpin: string;
  desktopHide: string;
  desktopSection: string;
  desktopShortcutLabel: string;
  desktopShortcutEnabled: string;
  desktopAutostart: string;
  desktopShortcutError: string;
  readerOpen: string;
  readerVerdictTab: string;
  readerGradeTab: string;
  readerFontSmaller: string;
  readerFontLarger: string;
}

const AR_STRINGS: AppStrings = {
  appName: 'أَثَر',
  appSubtitle: 'بحث سريع وواضح في الأحاديث النبوية',
  searchPlaceholder: 'ابحث بكلمة من الحديث… مثل: النيات',
  searchButton: 'بحث',
  clearSearch: 'مسح البحث',
  filtersLabel: 'تصفية حسب درجة الحديث',
  filters: {
    all: 'الكل',
    sahih: 'صحيح فقط',
    hasan: 'حسن',
    weak: 'لم يصح',
  },
  grades: {
    sahih: 'صحيح',
    sahih_isnad: 'إسناده صحيح',
    hasan: 'حسن',
    hasan_isnad: 'إسناده حسن',
    daif_isnad: 'إسناده ضعيف',
    daif: 'ضعيف',
    very_weak: 'ضعيف جداً',
    munkar: 'منكر',
    mawdu: 'موضوع',
    batil: 'باطل / لا أصل له',
    unknown: 'حكم مفصّل',
  },
  gradeDefinitions: {
    sahih: {
      quote:
        'أَمَّا الْحَدِيثُ الصَّحِيحُ: فَهُوَ الْحَدِيثُ الْمُسْنَدُ الَّذِي يَتَّصِلُ إِسْنَادُهُ بِنَقْلِ الْعَدْلِ الضَّابِطِ عَنِ الْعَدْلِ الضَّابِطِ إِلَى مُنْتَهَاهُ، وَلَا يَكُونُ شَاذًّا، وَلَا مُعَلَّلًا.',
      source: 'ابن الصلاح — معرفة أنواع علوم الحديث (مقدمة ابن الصلاح)',
      summary:
        'بمعنى مُبسّط: حديث ثابت متصل الإسناد برواة ثقات ضابطين بلا شذوذ ولا علة خفية؛ يُحتجّ به ويُعمل به.',
    },
    sahih_isnad: {
      quote:
        'فكأن المحدِّث إذا قال: "هذا حديث صحيح" قد تكفل لنا بتوفر شروط الصحة الخمسة في هذا الحديث، أما إذا قال: "هذا حديث صحيح الإسناد" فقد تكفل لنا بتوفر شروط ثلاثة من شروط الصحة، وهي: اتصال الإسناد، وعدالة الرواة وضبطهم، أما نفي الشذوذ، ونفي العلة عنه، فلم يتكفل بهما؛ لأنه لم يتثبت منهما. لكن لو اقتصر حافظ معتمد على قوله: "هذا حديث صحيح الإسناد" ولم يذكر له علة، فالظاهر صحة المتن؛ لأن الأصل عدم العلة، وعدم الشذوذ.',
      source: 'د. محمود الطحان — تيسير مصطلح الحديث',
      summary:
        'بمعنى مُبسّط: رواته ثقات وإسناده متصل، والأصل قَبوله والعمل به ما لم يثبت فيه شذوذ أو علة خفية عند نقّاد الحديث.',
    },
    hasan: {
      quote:
        'الحديث الحسن: هو الحديث الذي اتصل سنده بنقل عدل خف ضبطه غير شاذ ولا معلل.',
      source: 'د. نور الدين عتر — منهج النقد في علوم الحديث (معتمدًا تعريف ابن حجر)',
      summary:
        'بمعنى مُبسّط: حديث مقبول وثابت تتوفر فيه شروط الصحيح لكن حفظ بعض رواته أخفّ قليلًا؛ يُحتجّ به ويُعمل به.',
    },
    hasan_isnad: {
      quote:
        'قولهم: "هذا حديث حسن الإسناد" دون قولهم: "هذا حديث حسن"؛ لأنه قد يصلح أو يحسن الإسناد دون المتن؛ لشذوذ أو علة.',
      source: 'د. محمود الطحان — تيسير مصطلح الحديث',
      summary:
        'بمعنى مُبسّط: هذا الإسناد بعينه حسن ومقبول عند المحدث، والأصل الاحتجاج به ما لم يُبيّن فيه شذوذ أو علة.',
    },
    daif_isnad: {
      quote:
        'إِذَا رَأَيْتَ حَدِيثًا بِإِسْنَادٍ ضَعِيفٍ فَلَكَ أَنْ تَقُولَ: هَذَا ضَعِيفٌ، وَتَعْنِيَ أَنَّهُ بِذَلِكَ الْإِسْنَادِ ضَعِيفٌ، وَلَيْسَ لَكَ أَنْ تَقُولَ هَذَا ضَعِيفٌ وَتَعْنِي بِهِ ضَعْفَ مَتْنِ الْحَدِيثِ بِنَاءً عَلَى مُجَرَّدِ ضَعْفِ ذَلِكَ الْإِسْنَادِ، فَقَدْ يَكُونُ مَرْوِيًّا بِإِسْنَادٍ آخَرَ صَحِيحٍ يَثْبُتُ بِمِثْلِهِ الْحَدِيثُ.',
      source: 'ابن الصلاح — معرفة أنواع علوم الحديث (مقدمة ابن الصلاح)',
      summary:
        'بمعنى مُبسّط: الضعف هنا في هذا الإسناد بعينه، ولا يلزم منه ضعف المتن دائمًا فقد يثبت الحديث من طريق آخر صحيح.',
    },
    daif: {
      quote:
        'أحسن ما يعرف به الحديث الضعيف هو: ما فقد شرطا من شروط الحديث المقبول. وشروط الحديث المقبول ستة هي: العدالة: الضبط "ولو لم يكن تاما"، الاتصال، فقد الشذوذ، فقد العلة القادحة، العاضد عند الاحتياج إليه.',
      source: 'د. نور الدين عتر — منهج النقد في علوم الحديث',
      summary:
        'بمعنى مُبسّط: حديث فقد شرطًا أو أكثر من شروط القبول كضعف راوٍ أو انقطاع سند؛ لا يُنسب جزمًا للنبي ﷺ.',
    },
    very_weak: {
      quote:
        'وقد ميز المحدثون بين مراتب الضعف الناشيء من القدح في رجاله، فهناك الضعف الذي يقبل التقوية وهذا يسمونه ضعيفا أيا كان سبب ضعفه، وهناك الضعف الشديد الذي لا ينجبر وهذا يطلقون عليه أيضا الضعيف ويؤخذ من تعابيرهم تمييزه كقولهم ضعيف جدا. أو فيه فلان متروك أو متهم.',
      source: 'د. نور الدين عتر — منهج النقد في علوم الحديث',
      summary:
        'بمعنى مُبسّط: حديث شديد الضعف لوجود راوٍ متروك أو متهم بالكذب أو فاحش الغلط؛ لا يُحتجّ به ولا يتقوى بغيره.',
    },
    munkar: {
      quote: 'المنكر ما رواه الضعيف مخالفا لما رواه الثقة.',
      source: 'د. محمود الطحان — تيسير مصطلح الحديث (معتمدًا تعريف ابن حجر)',
      summary:
        'بمعنى مُبسّط: حديث رواه راوٍ ضعيف مخالفًا به رواية الثقات؛ وهو مردود ولا يُحتجّ به.',
    },
    mawdu: {
      quote:
        'الحديث الموضوع: هو المختلق المصنوع. أي الذي ينسب إلى رسول الله صلى الله عليه وسلم كذبا، وليس له صلة حقيقية بالنبي صلى الله عليه وسلم.',
      source: 'د. نور الدين عتر — منهج النقد في علوم الحديث',
      summary:
        'بمعنى مُبسّط: حديث مكذوب ومختلق نُسب زورًا إلى النبي ﷺ؛ لا يجوز روايته أو نشره إلا لبيان بطلانه.',
    },
    batil: {
      quote:
        'الألفاظ الدالة على الوضع: من ذلك قولهم: هذا حديث موضوع، أو كذب، أو باطل، أو لا أعرفه إذا صرح بذلك أحد الأئمة الكبار، وكذا قولهم: هذا الحديث لا أصل له، أي ليس له إسناد يعرف.',
      source: 'د. محمد محمد أبو شهبة — الوسيط في علوم ومصطلح الحديث',
      summary:
        'بمعنى مُبسّط: نص لا إسناد له أصلًا أو باطل الإسناد؛ لا يصح نسبته إلى النبي ﷺ.',
    },
    unknown: {
      summary:
        'حكم مركّب أو توضيح خاص من المحدّث (مثل صحة جزء من الحديث وضعف جزء آخر) — اقرأ نصّ حكم المحدّث بالأسفل.',
    },
  },
  gradeHelpAria: (gradeLabel) => `عرض معنى درجة «${gradeLabel}»`,
  gradeHintPrompt: 'اضغط على الدرجة لمعرفة معناها',
  dismissHint: 'إخفاء التلميح',
  otherRulingsLabel: (count) =>
    count === 1
      ? 'حكم ومصدر آخر لنفس الحديث'
      : count === 2
        ? 'حكمان ومصدران آخران لنفس الحديث'
        : `+${count} أحكام ومصادر أخرى لنفس الحديث`,
  narratorLabel: 'الراوي',
  narratorPrefix: 'عن',
  muhaddithLabel: 'المحدث',
  sourceLabel: 'المصدر',
  takhrijLabel: 'التخريج',
  verdictLabel: 'خلاصة الحكم',
  verdictByPrefix: 'حكم',
  osoulButton: 'المصادر الأصلية',
  osoulTitle: 'أصول الحديث بالأسانيد',
  altSahihButton: 'الصحيح البديل',
  altSahihTitle: 'الحديث الصحيح البديل في الباب',
  similarButton: 'أحاديث مشابهة',
  similarTitle: 'أحاديث مشابهة في المعنى',
  panelLoading: 'جاري التحميل…',
  panelEmpty: 'لا تتوفر بيانات إضافية لهذا الحديث.',
  panelError: 'تعذّر تحميل التفاصيل، حاول مرة أخرى.',
  copy: 'نسخ',
  copied: 'تم النسخ',
  share: 'مشاركة',
  sharedCopiedFallback: 'تم نسخ الحديث للمشاركة',
  showMoreMatn: 'عرض المزيد',
  showLessMatn: 'عرض أقل',
  matchBelowPreview: 'الكلمة في بقية النص',
  loadMore: 'عرض المزيد من الأحاديث',
  loadingMore: 'جاري التحميل…',
  endOfResults: 'نهاية النتائج المتاحة',
  resultsCount: (count, hasMore) => {
    const base =
      count === 1
        ? 'نتيجة واحدة'
        : count === 2
          ? 'نتيجتان'
          : count <= 10
            ? `${count} نتائج`
            : `${count} نتيجة`;
    return hasMore ? `عرض ${base} • المزيد متاح` : base;
  },
  correctedBanner: (effective, original) =>
    `عرض النتائج لكلمة «${effective}» بدلًا من «${original}»`,
  relaxedBanner: (effective, original) =>
    `أقرب النتائج المطابقة لـ «${original}» (بحثًا عن: «${effective}»)`,
  conceptBanner: (effective, original) =>
    `لم يرد لفظ «${original}» حرفيًا في نص الحديث — عرض أحاديث في نفس المعنى («${effective}»)`,
  searchExactInstead: (original) => `ابحث عن «${original}» كما كُتبت`,
  didYouMean: 'هل تقصد:',
  recentSearches: 'عمليات البحث الأخيرة',
  clearRecent: 'مسح السجل',
  tryExamples: 'جرّب البحث عن',
  emptyHeading: 'ابحث في السنة النبوية بوضوح',
  emptyBody:
    'اكتب أي كلمة تتذكرها من بداية الحديث أو وسطه أو آخره، مع بيان درجة الصحة وحكم العلماء مباشرة.',
  noResultsHeading: 'لا توجد نتائج مطابقة',
  noResultsBody:
    'جرّب كلمة أخرى من الحديث، أو بدّل خيار التصفية إلى «الكل» لعرض جميع الدرجات.',
  errorHeading: 'تعذّر الاتصال بالموسوعة',
  errorBody: 'تحقّق من اتصالك بالإنترنت ثم حاول مرة أخرى.',
  retry: 'إعادة المحاولة',
  settingsTitle: 'الإعدادات وحول التطبيق',
  settingsButtonLabel: 'فتح الإعدادات ومعلومات التطبيق',
  close: 'إغلاق',
  languageSection: 'لغة الواجهة',
  themeSection: 'المظهر',
  themes: {
    system: 'تلقائي',
    light: 'فاتح',
    dark: 'داكن',
  },
  systemCurrentlyLight: 'تلقائي (فاتح حاليًا)',
  systemCurrentlyDark: 'تلقائي (داكن حاليًا)',
  readingSizeSection: 'حجم خط الحديث',
  readingSizes: {
    sm: 'مضغوط',
    md: 'مريح',
    lg: 'كبير',
  },
  aboutSection: 'المصدر والأمانة العلمية',
  aboutCredit:
    'جميع نصوص الأحاديث وأحكام المحدثين مستمدة مباشرة من الموسوعة الحديثية — موقع الدرر السنية (dorar.net) دون تعديل.',
  aboutVersion: 'الإصدار 1.4.3',
  updateAvailableTitle: (version) => `تحديث جديد متاح — الإصدار ${version}`,
  updateAvailableHint: 'يتوفر إصدار مستقر أحدث من تطبيق أَثَر.',
  downloadUpdate: 'تحميل التحديث',
  dismissUpdate: 'تجاهل التحديث',
  checkForUpdates: 'التحقق من التحديثات',
  checkingForUpdates: 'جاري التحقق…',
  upToDate: 'تستخدم أحدث إصدار',
  updateCheckFailed: 'تعذّر التحقق الآن، حاول لاحقًا',
  switchLangLabel: 'Switch interface to English',
  switchLangShort: 'EN',
  desktopQuickSearch: 'بحث سريع',
  desktopPin: 'تثبيت النافذة',
  desktopUnpin: 'إلغاء تثبيت النافذة',
  desktopHide: 'إخفاء النافذة',
  desktopSection: 'اختصار سطح المكتب',
  desktopShortcutLabel: 'مفتاح الإظهار السريع',
  desktopShortcutEnabled: 'تفعيل الاختصار العام',
  desktopAutostart: 'التشغيل تلقائيًا مع ويندوز',
  desktopShortcutError: 'تعذّر تسجيل هذا الاختصار، قد يكون مستخدمًا في تطبيق آخر.',
  readerOpen: 'عرض في بطاقة القراءة',
  readerVerdictTab: 'الحكم والتخريج',
  readerGradeTab: 'شرح الدرجة',
  readerFontSmaller: 'تصغير الخط',
  readerFontLarger: 'تكبير الخط',
};

const EN_STRINGS: AppStrings = {
  appName: 'Athar',
  appSubtitle: 'Clear, fast Arabic Hadith search',
  searchPlaceholder: 'Search any Arabic word… e.g. النيات',
  searchButton: 'Search',
  clearSearch: 'Clear search',
  filtersLabel: 'Filter by hadith authenticity',
  filters: {
    all: 'All',
    sahih: 'Sahih only',
    hasan: 'Hasan',
    weak: 'Unauthentic',
  },
  grades: {
    sahih: 'Sahih',
    sahih_isnad: 'Sahih Chain',
    hasan: 'Hasan',
    hasan_isnad: 'Hasan Chain',
    daif_isnad: 'Weak Chain',
    daif: "Da'if (Weak)",
    very_weak: 'Very Weak',
    munkar: 'Munkar',
    mawdu: 'Fabricated',
    batil: 'Baseless',
    unknown: 'Detailed Ruling',
  },
  gradeDefinitions: {
    sahih: {
      quote:
        "As for the Sahih hadith: it is the connected narration whose chain links upright, accurate narrators from start to end, free from anomaly (shudhudh) and hidden defect ('illah).",
      source: "Ibn al-Salah — Muqaddimat Ibn al-Salah (Ma'rifat Anwa' 'Ulum al-Hadith)",
      summary:
        'In plain words: An authentic, unbroken narration transmitted by trustworthy, precise narrators; relied upon in belief and practice.',
    },
    sahih_isnad: {
      quote:
        'When a scholar says "this hadith is Sahih," he vouches for all five conditions of authenticity; when he says "its chain (isnad) is Sahih," he vouches for three — unbroken chain, upright narrators, and precision — without explicitly ruling out anomaly or hidden defect. Yet if a reliable scholar stops at saying its chain is Sahih without noting a defect, the text is apparently authentic since freedom from defect is the default.',
      source: 'Dr. Mahmud al-Tahhan — Taysir Mustalah al-Hadith',
      summary:
        'In plain words: The chain of narrators is trustworthy and unbroken; generally accepted unless scholars identify a hidden defect in the text.',
    },
    hasan: {
      quote:
        "The Hasan hadith is a narration whose chain is unbroken through upright narrators with lighter precision, free from anomaly (shudhudh) and hidden defect ('illah).",
      source: "Dr. Nur al-Din 'Itr — Manhaj al-Naqd fi 'Ulum al-Hadith (after Ibn Hajar)",
      summary:
        'In plain words: An accepted, reliable narration whose narrators are trustworthy with slightly lighter precision than Sahih.',
    },
    hasan_isnad: {
      quote:
        'Their saying "this hadith has a Hasan chain (isnad)" falls short of saying "this hadith is Hasan," because the chain may be sound while the text is not due to an anomaly or hidden defect.',
      source: 'Dr. Mahmud al-Tahhan — Taysir Mustalah al-Hadith',
      summary:
        'In plain words: This specific chain of narrators is sound (Hasan); generally relied upon unless a hidden defect is noted.',
    },
    daif_isnad: {
      quote:
        'If you see a hadith with a weak chain, you may say it is weak by that chain — but you may not declare the text itself weak based solely on the weakness of that chain, for it may be narrated through another authentic chain by which the hadith is established.',
      source: "Ibn al-Salah — Muqaddimat Ibn al-Salah (Ma'rifat Anwa' 'Ulum al-Hadith)",
      summary:
        'In plain words: This specific chain is weak — though the wording itself may still be authentic through another stronger chain.',
    },
    daif: {
      quote:
        "The best definition of a Da'if (weak) hadith is one missing any condition of an accepted hadith — uprightness, precision (even if light), an unbroken chain, absence of anomaly, absence of a disqualifying defect, and corroboration when needed.",
      source: "Dr. Nur al-Din 'Itr — Manhaj al-Naqd fi 'Ulum al-Hadith",
      summary:
        'In plain words: A narration missing one or more conditions of authenticity (e.g. a broken chain or weak narrator); not definitively attributed to the Prophet ﷺ.',
    },
    very_weak: {
      quote:
        'Scholars distinguish degrees of weakness arising from narrator criticism: mild weakness that can be strengthened (called Da\'if), and severe weakness that cannot be repaired — distinguished by phrases such as "very weak" (da\'if jiddan) or noting a discarded (matruk) or suspect narrator.',
      source: "Dr. Nur al-Din 'Itr — Manhaj al-Naqd fi 'Ulum al-Hadith",
      summary:
        'In plain words: A severely weak narration with a discarded, severely mistaken, or suspect narrator; cannot be relied upon or strengthened.',
    },
    munkar: {
      quote:
        'Al-Munkar is what a weak narrator transmits in contradiction to what a trustworthy narrator transmits.',
      source: 'Dr. Mahmud al-Tahhan — Taysir Mustalah al-Hadith (after Ibn Hajar)',
      summary:
        'In plain words: A rejected report in which a weak narrator contradicts trustworthy narrators; cannot be relied upon.',
    },
    mawdu: {
      quote:
        'The fabricated (Mawdu\') hadith is the invented, manufactured report — falsely attributed to the Messenger of Allah ﷺ with no real connection to him.',
      source: "Dr. Nur al-Din 'Itr — Manhaj al-Naqd fi 'Ulum al-Hadith",
      summary:
        'In plain words: A falsely invented narration attributed to the Prophet ﷺ; must not be shared except to warn against it.',
    },
    batil: {
      quote:
        'Expressions indicating fabrication include saying: "this hadith is fabricated (mawdu\')," "a lie," "baseless (batil)," or "I do not know it" when stated by a major master — as well as saying "this hadith has no origin (la asla lahu)," meaning it has no known chain of transmission.',
      source: 'Dr. Muhammad Abu Shahbah — Al-Wasit fi \'Ulum wa Mustalah al-Hadith',
      summary:
        'In plain words: A baseless report with no valid chain or origin in the Hadith corpus; cannot be attributed to the Prophet ﷺ.',
    },
    unknown: {
      summary:
        "Nuanced or split scholar ruling (for example, one part authentic and another weak) — read the scholar's exact ruling below.",
    },
  },
  gradeHelpAria: (gradeLabel) => `Explain what "${gradeLabel}" means`,
  gradeHintPrompt: 'Tap any badge to see its meaning',
  dismissHint: 'Dismiss tip',
  otherRulingsLabel: (count) =>
    count === 1
      ? '+1 other scholar & source'
      : `+${count} other scholars & sources`,
  narratorLabel: 'Narrator',
  narratorPrefix: 'Narrated by',
  muhaddithLabel: 'Scholar',
  sourceLabel: 'Source',
  takhrijLabel: 'Primary Sources (Takhrij)',
  verdictLabel: 'Ruling',
  verdictByPrefix: 'Ruling by',
  osoulButton: 'Original Sources',
  osoulTitle: 'Original Texts & Chains',
  altSahihButton: 'Authentic Alternative',
  altSahihTitle: 'Authentic Alternative Hadith',
  similarButton: 'Similar Wordings',
  similarTitle: 'Similar Hadiths in Meaning',
  panelLoading: 'Loading…',
  panelEmpty: 'No additional entries available for this hadith.',
  panelError: 'Could not load details. Please try again.',
  copy: 'Copy',
  copied: 'Copied',
  share: 'Share',
  sharedCopiedFallback: 'Hadith copied to share',
  showMoreMatn: 'Show more',
  showLessMatn: 'Show less',
  matchBelowPreview: 'Match further down',
  loadMore: 'Load more hadiths',
  loadingMore: 'Loading…',
  endOfResults: 'End of available results',
  resultsCount: (count, hasMore) => {
    const base = count === 1 ? '1 result' : `${count} results`;
    return hasMore ? `Showing ${base} • more available` : base;
  },
  correctedBanner: (effective, original) =>
    `Showing results for "${effective}" instead of "${original}"`,
  relaxedBanner: (effective, original) =>
    `Closest matching hadiths for "${original}" (matching: "${effective}")`,
  conceptBanner: (effective, original) =>
    `"${original}" was not found verbatim — showing related hadiths for "${effective}"`,
  searchExactInstead: (original) => `Search "${original}" as typed`,
  didYouMean: 'Did you mean:',
  recentSearches: 'Recent searches',
  clearRecent: 'Clear',
  tryExamples: 'Try searching for',
  emptyHeading: 'Search Prophetic Hadiths with clarity',
  emptyBody:
    'Type any Arabic word from the beginning, middle, or end of a hadith to view narrations alongside clear scholarly gradings.',
  noResultsHeading: 'No matching hadiths found',
  noResultsBody:
    'Try another Arabic word from the hadith, or switch the filter back to "All" to include every grading.',
  errorHeading: 'Could not reach Al-Dorar',
  errorBody: 'Please check your internet connection and try again.',
  retry: 'Try again',
  settingsTitle: 'Settings & About',
  settingsButtonLabel: 'Open settings and app information',
  close: 'Close',
  languageSection: 'Interface Language',
  themeSection: 'Appearance',
  themes: {
    system: 'System',
    light: 'Light',
    dark: 'Dark',
  },
  systemCurrentlyLight: 'System (Light)',
  systemCurrentlyDark: 'System (Dark)',
  readingSizeSection: 'Hadith Text Size',
  readingSizes: {
    sm: 'Compact',
    md: 'Comfortable',
    lg: 'Large',
  },
  aboutSection: 'Source & Attribution',
  aboutCredit:
    'All hadith texts and scholar verdicts are retrieved live and verbatim from the Al-Dorar Al-Saniyyah Hadith Encyclopedia (dorar.net).',
  aboutVersion: 'Version 1.4.3',
  updateAvailableTitle: (version) => `New update available — v${version}`,
  updateAvailableHint: 'A newer stable version of Athar is ready to download.',
  downloadUpdate: 'Download update',
  dismissUpdate: 'Dismiss update',
  checkForUpdates: 'Check for updates',
  checkingForUpdates: 'Checking…',
  upToDate: 'You are on the latest version',
  updateCheckFailed: 'Could not check right now',
  switchLangLabel: 'تبديل الواجهة إلى العربية',
  switchLangShort: 'ع',
  desktopQuickSearch: 'Quick Search',
  desktopPin: 'Pin window',
  desktopUnpin: 'Unpin window',
  desktopHide: 'Hide window',
  desktopSection: 'Desktop Quick Access',
  desktopShortcutLabel: 'Global Shortcut Key',
  desktopShortcutEnabled: 'Enable global shortcut',
  desktopAutostart: 'Launch at Windows startup',
  desktopShortcutError: 'Could not register this shortcut; it may be in use by another app.',
  readerOpen: 'Open in reader card',
  readerVerdictTab: 'Verdict & Sources',
  readerGradeTab: 'Grade Meaning',
  readerFontSmaller: 'Smaller text',
  readerFontLarger: 'Larger text',
};

export function getStrings(locale: Locale): AppStrings {
  return locale === 'ar' ? AR_STRINGS : EN_STRINGS;
}

export const EXAMPLE_QUERIES: readonly string[] = [
  'النيات',
  'النار',
  'الرحمة',
  'الجنة',
  'الصلاة',
];
