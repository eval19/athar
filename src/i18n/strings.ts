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
  loadMore: string;
  loadingMore: string;
  endOfResults: string;
  resultsCount: (count: number, hasMore: boolean) => string;
  correctedBanner: (effective: string, original: string) => string;
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
  switchLangLabel: string;
  switchLangShort: string;
}

const AR_STRINGS: AppStrings = {
  appName: 'أَثَر',
  appSubtitle: 'بحث سريع وواضح في الأحاديث النبوية',
  searchPlaceholder: 'اكتب أي كلمة من الحديث… مثل: النيات، النار، الرحمة',
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
        'هُوَ الْحَدِيثُ الْمُسْنَدُ الَّذِي يَتَّصِلُ إِسْنَادُهُ بِنَقْلِ الْعَدْلِ الضَّابِطِ عَنِ الْعَدْلِ الضَّابِطِ إِلَى مُنْتَهَاهُ، وَلَا يَكُونُ شَاذًّا، وَلَا مُعَلَّلًا.',
      source: 'ابن الصلاح — معرفة أنواع علوم الحديث (مقدمة ابن الصلاح)',
      summary:
        'بمعنى مُبسّط: حديث ثابت متصل الإسناد برواة ثقات ضابطين بلا شذوذ ولا علة خفية؛ يُحتجّ به ويُعمل به.',
    },
    sahih_isnad: {
      quote:
        'قَوْلُهُمْ " هَذَا حَدِيثٌ صَحِيحُ الْإِسْنَادِ، أَوْ حَسَنُ الْإِسْنَادِ " دُونَ قَوْلِهِمْ: " هَذَا حَدِيثٌ صَحِيحٌ أَوْ حَدِيثٌ حَسَنٌ " لِأَنَّهُ قَدْ يُقَالُ: " هَذَا حَدِيثٌ صَحِيحُ الْإِسْنَادِ "، وَلَا يَصِحُّ، لِكَوْنِهِ شَاذًّا أَوْ مُعَلَّلًا. غَيْرَ أَنَّ الْمُصَنِّفَ الْمُعْتَمَدَ مِنْهُمْ إِذَا اقْتَصَرَ عَلَى قَوْلِهِ: إِنَّهُ صَحِيحُ الْإِسْنَادِ، وَلَمْ يَذْكُرْ لَهُ عِلَّةً، وَلَمْ يَقْدَحْ فِيهِ، فَالظَّاهِرُ مِنْهُ الْحُكْمُ لَهُ بِأَنَّهُ صَحِيحٌ فِي نَفْسِهِ.',
      source: 'ابن الصلاح — معرفة أنواع علوم الحديث (مقدمة ابن الصلاح)',
      summary:
        'بمعنى مُبسّط: رواته ثقات وإسناده متصل، والأصل قَبوله والعمل به ما لم يثبت فيه شذوذ أو علة خفية عند نقّاد الحديث.',
    },
    hasan: {
      quote:
        'فإنْ خَفَّ الضبطُ… والمرادُ مع بقية الشروط المتقدِّمة في حدِّ الصحيح فهو الحَسَنُ لِذَاتِه.',
      source: 'ابن حجر العسقلاني — نزهة النظر في توضيح نخبة الفكر',
      summary:
        'بمعنى مُبسّط: حديث مقبول وثابت تتوفر فيه شروط الصحيح لكن حفظ بعض رواته أخفّ قليلًا؛ يُحتجّ به ويُعمل به.',
    },
    hasan_isnad: {
      quote:
        'قَوْلُهُمْ " هَذَا حَدِيثٌ صَحِيحُ الْإِسْنَادِ، أَوْ حَسَنُ الْإِسْنَادِ " دُونَ قَوْلِهِمْ: " هَذَا حَدِيثٌ صَحِيحٌ أَوْ حَدِيثٌ حَسَنٌ " لِأَنَّهُ قَدْ يُقَالُ: " هَذَا حَدِيثٌ صَحِيحُ الْإِسْنَادِ "، وَلَا يَصِحُّ، لِكَوْنِهِ شَاذًّا أَوْ مُعَلَّلًا.',
      source: 'ابن الصلاح — معرفة أنواع علوم الحديث (مقدمة ابن الصلاح)',
      summary:
        'بمعنى مُبسّط: هذا الإسناد بعينه حسن ومقبول عند المحدث، والأصل الاحتجاج به ما لم يُبيّن فيه شذوذ أو علة.',
    },
    daif_isnad: {
      quote:
        'لَيْسَ كُلُّ ضَعْفٍ فِي الْحَدِيثِ يَزُولُ بِمَجِيئِهِ مِنْ وُجُوهٍ، بَلْ ذَلِكَ يَتَفَاوَتُ: فَمِنْهُ ضَعْفٌ يُزِيلُهُ ذَلِكَ بِأَنْ يَكُونَ ضَعْفُهُ نَاشِئًا مِنْ ضَعْفِ حِفْظِ رَاوِيهِ، مَعَ كَوْنِهِ مِنْ أَهْلِ الصِّدْقِ وَالدِّيَانَةِ.',
      source: 'ابن الصلاح — معرفة أنواع علوم الحديث (مقدمة ابن الصلاح)',
      summary:
        'بمعنى مُبسّط: الضعف هنا في هذا الإسناد بعينه، ولا يلزم منه ضعف المتن دائمًا فقد يثبت الحديث من طريق آخر صحيح.',
    },
    daif: {
      quote:
        'كُلُّ حَدِيثٍ لَمْ يَجْتَمِعْ فِيهِ صِفَاتُ الْحَدِيثِ الصَّحِيحِ، وَلَا صِفَاتُ الْحَدِيثِ الْحَسَنِ الْمَذْكُورَاتُ فِيمَا تَقَدَّمَ، فَهُوَ حَدِيثٌ ضَعِيفٌ.',
      source: 'ابن الصلاح — معرفة أنواع علوم الحديث (مقدمة ابن الصلاح)',
      summary:
        'بمعنى مُبسّط: حديث فقد شرطًا أو أكثر من شروط القبول كضعف راوٍ أو انقطاع سند؛ لا يُنسب جزمًا للنبي ﷺ.',
    },
    very_weak: {
      quote:
        'وَمِنْ ذَلِكَ ضَعْفٌ لَا يَزُولُ بِنَحْوِ ذَلِكَ، لِقُوَّةِ الضَّعْفِ وَتَقَاعُدِ هَذَا الْجَابِرِ عَنْ جَبْرِهِ وَمُقَاوَمَتِهِ، وَذَلِكَ كَالضَّعْفِ الَّذِي يَنْشَأُ مِنْ كَوْنِ الرَّاوِي مُتَّهَمًا بِالْكَذِبِ، أَوْ كَوْنِ الْحَدِيثِ شَاذًّا.',
      source: 'ابن الصلاح — معرفة أنواع علوم الحديث (مقدمة ابن الصلاح)',
      summary:
        'بمعنى مُبسّط: حديث شديد الضعف لوجود راوٍ متروك أو متهم بالكذب أو فاحش الغلط؛ لا يُحتجّ به ولا يتقوى بغيره.',
    },
    munkar: {
      quote:
        'وإنْ وقعتِ المُخَالَفَةُ مع الضَّعْفِ فالرَّاجِحُ يُقَالُ له المعروفُ، ومُقَابِلُه يقالُ له المُنْكَرُ.',
      source: 'ابن حجر العسقلاني — نزهة النظر في توضيح نخبة الفكر',
      summary:
        'بمعنى مُبسّط: حديث رواه راوٍ ضعيف مخالفًا به رواية الثقات؛ وهو مردود ولا يُحتجّ به.',
    },
    mawdu: {
      quote:
        'وَهُوَ الْمُخْتَلَقُ الْمَصْنُوعُ… الْحَدِيثُ الْمَوْضُوعُ شَرُّ الْأَحَادِيثِ الضَّعِيفَةِ، وَلَا تَحِلُّ رِوَايَتُهُ لِأَحَدٍ عَلِمَ حَالَهُ فِي أَيِّ مَعْنًى كَانَ إِلَّا مَقْرُونًا بِبَيَانِ وَضْعِهِ.',
      source: 'ابن الصلاح — معرفة أنواع علوم الحديث (مقدمة ابن الصلاح)',
      summary:
        'بمعنى مُبسّط: حديث مكذوب ومختلق نُسب زورًا إلى النبي ﷺ؛ لا يجوز روايته أو نشره إلا لبيان بطلانه.',
    },
    batil: {
      quote:
        'كان يستعمل في عرف السلف في الحديث يروى بإسناد، لكنه خطأ أو باطل لا حقيقة له ولم يوجد أصلاً… وإذا حكموا بذلك على الحديث أرادوا: لا أصل له عن النبي صلى الله عليه وسلم.',
      source: 'عبد الله الجديع — تحرير علوم الحديث',
      summary:
        'بمعنى مُبسّط: نص لا إسناد له أصلًا أو باطل الإسناد؛ لا يصح نسبته إلى النبي ﷺ.',
    },
    unknown: {
      summary:
        'حكم مركّب أو توضيح خاص من المحدّث (مثل صحة جزء من الحديث وضعف جزء آخر) — اقرأ نصّ حكم المحدّث بالأسفل.',
    },
  },
  gradeHelpAria: (gradeLabel) => `عرض معنى درجة «${gradeLabel}»`,
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
  aboutVersion: 'الإصدار 1.0',
  switchLangLabel: 'Switch interface to English',
  switchLangShort: 'EN',
};

const EN_STRINGS: AppStrings = {
  appName: 'Athar',
  appSubtitle: 'Clear, fast Arabic Hadith search',
  searchPlaceholder: 'Type any Arabic word… e.g. النيات، النار، الرحمة',
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
        "The connected narration whose chain links upright, accurate narrators from start to end, free from anomaly (shudhudh) and hidden defect ('illah).",
      source: "Ibn al-Salah — Muqaddimat Ibn al-Salah (Ma'rifat Anwa' 'Ulum al-Hadith)",
      summary:
        'In plain words: An authentic, unbroken narration transmitted by trustworthy, precise narrators; relied upon in belief and practice.',
    },
    sahih_isnad: {
      quote:
        'Their saying "this hadith has a Sahih chain (isnad) or a Hasan chain" falls short of saying "this hadith is Sahih or Hasan", because a chain may be Sahih yet the hadith not authentic due to anomaly or a hidden defect — though when a reliable scholar limits himself to saying its chain is Sahih without mentioning a defect, the apparent ruling is that it is authentic.',
      source: "Ibn al-Salah — Muqaddimat Ibn al-Salah (Ma'rifat Anwa' 'Ulum al-Hadith)",
      summary:
        'In plain words: The chain of narrators is trustworthy and unbroken; generally accepted unless scholars identify a hidden defect in the text.',
    },
    hasan: {
      quote:
        'If precision (dabt) is lighter — while all remaining conditions of Sahih are met — then it is Hasan li-dhatihi (sound in itself).',
      source: "Ibn Hajar al-'Asqalani — Nuzhat al-Nazar fi Tawdih Nukhbat al-Fikar",
      summary:
        'In plain words: An accepted, reliable narration whose narrators are trustworthy with slightly lighter precision than Sahih.',
    },
    hasan_isnad: {
      quote:
        'Their saying "this hadith has a Sahih chain or a Hasan chain" falls short of saying "this hadith is Sahih or Hasan", because a chain may appear sound while a hidden defect or anomaly exists.',
      source: "Ibn al-Salah — Muqaddimat Ibn al-Salah (Ma'rifat Anwa' 'Ulum al-Hadith)",
      summary:
        'In plain words: This specific chain of narrators is sound (Hasan); generally relied upon unless a hidden defect is noted.',
    },
    daif_isnad: {
      quote:
        'Not every weakness in a hadith is removed by coming through other routes; rather it varies — some weakness arises only from light memory in an honest narrator and can be strengthened by corroborating chains.',
      source: "Ibn al-Salah — Muqaddimat Ibn al-Salah (Ma'rifat Anwa' 'Ulum al-Hadith)",
      summary:
        'In plain words: This specific chain is weak — though the wording itself may still be authentic through another stronger chain.',
    },
    daif: {
      quote:
        "Every hadith that fails to combine the attributes of a Sahih hadith and the attributes of a Hasan hadith is a Da'if (weak) hadith.",
      source: "Ibn al-Salah — Muqaddimat Ibn al-Salah (Ma'rifat Anwa' 'Ulum al-Hadith)",
      summary:
        'In plain words: A narration missing one or more conditions of authenticity (e.g. a broken chain or weak narrator); not definitively attributed to the Prophet ﷺ.',
    },
    very_weak: {
      quote:
        'Among weakness is a weakness that does not disappear through corroboration due to its severity — such as when a narrator is accused of lying.',
      source: "Ibn al-Salah — Muqaddimat Ibn al-Salah (Ma'rifat Anwa' 'Ulum al-Hadith)",
      summary:
        'In plain words: A severely weak narration with a discarded, severely mistaken, or suspect narrator; cannot be relied upon or strengthened.',
    },
    munkar: {
      quote:
        "If contradiction occurs alongside weakness in the narrator, the stronger report is called al-Ma'ruf and its counterpart is called al-Munkar.",
      source: "Ibn Hajar al-'Asqalani — Nuzhat al-Nazar fi Tawdih Nukhbat al-Fikar",
      summary:
        'In plain words: A rejected report in which a weak narrator contradicts trustworthy narrators; cannot be relied upon.',
    },
    mawdu: {
      quote:
        'It is the invented, fabricated report — the worst of weak reports, and it is not permissible for anyone who knows its state to narrate it except while clarifying its fabrication.',
      source: "Ibn al-Salah — Muqaddimat Ibn al-Salah (Ma'rifat Anwa' 'Ulum al-Hadith)",
      summary:
        'In plain words: A falsely invented narration attributed to the Prophet ﷺ; must not be shared except to warn against it.',
    },
    batil: {
      quote:
        'Used by the early scholars for a report with a false or nonexistent basis; when applied to a hadith, it means it has no origin from the Prophet ﷺ.',
      source: "'Abdullah al-Juday' — Tahrir 'Ulum al-Hadith",
      summary:
        'In plain words: A baseless report with no valid chain or origin in the Hadith corpus; cannot be attributed to the Prophet ﷺ.',
    },
    unknown: {
      summary:
        "Nuanced or split scholar ruling (for example, one part authentic and another weak) — read the scholar's exact ruling below.",
    },
  },
  gradeHelpAria: (gradeLabel) => `Explain what "${gradeLabel}" means`,
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
  loadMore: 'Load more hadiths',
  loadingMore: 'Loading…',
  endOfResults: 'End of available results',
  resultsCount: (count, hasMore) => {
    const base = count === 1 ? '1 result' : `${count} results`;
    return hasMore ? `Showing ${base} • more available` : base;
  },
  correctedBanner: (effective, original) =>
    `Showing results for "${effective}" instead of "${original}"`,
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
  aboutVersion: 'Version 1.0',
  switchLangLabel: 'تبديل الواجهة إلى العربية',
  switchLangShort: 'ع',
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
