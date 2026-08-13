/**
 * Corpus of Moroccan legal provisions, v1 seed.
 *
 * IMPORTANT — READ BEFORE PUBLISHING
 * ----------------------------------
 * `META.verified` is false. Every entry below was drafted from the general
 * content of the cited laws and MUST be checked article-by-article against the
 * official consolidated text published by the Secrétariat Général du
 * Gouvernement (sgg.gov.ma) before this app is put in front of real users.
 * Laws get amended; an out-of-date "right" is worse than no app at all.
 *
 * Each entry carries the exact article reference so that any claim the app
 * makes is traceable. That traceability is the product. Do not add an entry
 * that cannot cite an article.
 *
 * Field guide:
 *   id     stable slug, used in deep links (#/a/<id>) — never renumber
 *   cat    category id (see CATEGORIES)
 *   ref    { law, art } — the citation shown under every fact
 *   title  short heading, per language
 *   fact   notification-length line (<= 150 chars) — the "did you know"
 *   body   the explanation shown on the detail card
 *   dz     Darija gloss of the fact, Arabic script (optional but wanted)
 *   tags   free keywords, fed into search
 */

export const META = {
  version: '0.1.0-seed',
  corpusDate: '2026-08',
  verified: false,
  disclaimer: {
    ar: 'هاد التطبيق كيقدم معلومات قانونية عامة فقط، وماشي استشارة قانونية. فحالة نزاع، تواصل مع محامٍ.',
    fr: "Cette application fournit une information juridique générale et ne constitue pas un conseil juridique. En cas de litige, consultez un avocat.",
  },
};

export const CATEGORIES = [
  {
    id: 'police',
    icon: '🛡️',
    ar: 'التوقيف وحقوق المشتبه فيه',
    fr: 'Contrôles, arrestation et garde à vue',
    law: { ar: 'قانون المسطرة الجنائية 22.01 + دستور 2011', fr: 'Loi 22-01 (procédure pénale) + Constitution 2011' },
    source: 'https://www.sgg.gov.ma/',
  },
  {
    id: 'route',
    icon: '🚗',
    ar: 'قانون السير',
    fr: 'Code de la route',
    law: { ar: 'القانون 52.05 المتعلق بمدونة السير', fr: 'Loi 52-05 portant code de la route' },
    source: 'https://www.sgg.gov.ma/',
  },
  {
    id: 'travail',
    icon: '👷',
    ar: 'مدونة الشغل',
    fr: 'Code du travail',
    law: { ar: 'القانون 65.99 المتعلق بمدونة الشغل', fr: 'Loi 65-99 portant code du travail' },
    source: 'https://www.sgg.gov.ma/',
  },
  {
    id: 'famille',
    icon: '👪',
    ar: 'مدونة الأسرة',
    fr: 'Code de la famille (Moudawana)',
    law: { ar: 'القانون 70.03 بمثابة مدونة الأسرة', fr: 'Loi 70-03 portant code de la famille' },
    source: 'https://www.sgg.gov.ma/',
  },
];

export const ARTICLES = [
  /* ---------------------------------------------------------------- police */
  {
    id: 'gav-duree',
    cat: 'police',
    ref: { law: 'المسطرة الجنائية / Procédure pénale', art: '66' },
    title: { ar: 'مدة الحراسة النظرية', fr: 'Durée de la garde à vue' },
    fact: {
      ar: 'الحراسة النظرية محدودة فـ 48 ساعة، وكيمكن تمدد بـ 24 ساعة وحدة فقط بإذن كتابي من النيابة العامة.',
      fr: 'La garde à vue est limitée à 48 heures, prolongeable une seule fois de 24 heures sur autorisation écrite du procureur.',
    },
    dz: 'ماكاينش حراسة نظرية بلا حدود: 48 ساعة، و24 أخرى غير بورقة من الوكيل.',
    body: {
      ar: 'المدة الأصلية للحراسة النظرية هي 48 ساعة تبتدي من ساعة التوقيف الفعلي، ماشي من ساعة الوصول للمخفر. التمديد ممكن مرة وحدة بـ 24 ساعة، وخاصو إذن كتابي من النيابة العامة. كاينة استثناءات بمدد أطول فـ قضايا أمن الدولة والإرهاب. أي تجاوز لهاد المدد بلا سند قانوني هو احتجاز تعسفي.',
      fr: "La durée de droit commun de la garde à vue est de 48 heures, décomptées à partir du moment de l'arrestation effective et non de l'arrivée au commissariat. Elle peut être prolongée une seule fois de 24 heures, sur autorisation écrite du procureur. Des régimes plus longs existent en matière de sûreté de l'État et de terrorisme. Tout dépassement sans base légale constitue une détention arbitraire.",
    },
    tags: ['garde à vue', 'حراسة نظرية', '48', 'توقيف', 'arrestation', 'procureur'],
  },
  {
    id: 'gav-motifs',
    cat: 'police',
    ref: { law: 'المسطرة الجنائية / Procédure pénale', art: '66' },
    title: { ar: 'الحق فـ معرفة سبب التوقيف', fr: 'Droit de connaître le motif' },
    fact: {
      ar: 'عندك الحق تعرف سبب توقيفك، وتخبر عائلتك، بلغة كتفهمها — هادشي إجباري ماشي تفضّل.',
      fr: "Vous avez le droit d'être informé du motif de votre arrestation et de prévenir votre famille. C'est une obligation, pas une faveur.",
    },
    dz: 'خصهم يقولو ليك علاش توقفتي، وخصك تعيّط لداركم. هادشي حق ديالك.',
    body: {
      ar: 'ضابط الشرطة القضائية ملزم يخبر الشخص الموضوع تحت الحراسة النظرية فورا وبلغة كيفهمها بأسباب توقيفه وبالحقوق المخولة ليه، ومنها إخبار العائلة. عدم الإخبار كيشكل خرقا للمسطرة يمكن التمسك بيه أمام المحكمة.',
      fr: "L'officier de police judiciaire doit informer immédiatement la personne placée en garde à vue, dans une langue qu'elle comprend, des motifs de son arrestation et des droits qui lui sont reconnus, dont celui d'aviser sa famille. L'absence d'information constitue une irrégularité de procédure invocable devant le tribunal.",
    },
    tags: ['motif', 'famille', 'إخبار', 'حقوق', 'droits'],
  },
  {
    id: 'gav-avocat',
    cat: 'police',
    ref: { law: 'المسطرة الجنائية / Procédure pénale', art: '66' },
    title: { ar: 'الاتصال بمحامٍ', fr: 'Contact avec un avocat' },
    fact: {
      ar: 'كيحق ليك تطلب الاتصال بمحامٍ خلال الحراسة النظرية. الطلب كيتسجل فـ المحضر.',
      fr: "Vous pouvez demander à contacter un avocat pendant la garde à vue. La demande est consignée au procès-verbal.",
    },
    dz: 'طلب المحامي من اللول، وخصهم يكتبو الطلب ديالك فالمحضر.',
    body: {
      ar: 'القانون كيخول للشخص الموضوع تحت الحراسة النظرية طلب الاتصال بمحامٍ، وهاد الطلب خاصو يتسجل فـ محضر الحراسة النظرية. نصيحة عملية: طلب الاتصال بالمحامي شفويا وبوضوح، وتأكد بلي تسجل، لأن المحضر هو الوثيقة اللي غادي تعتمد عليها المحكمة.',
      fr: "La loi reconnaît à la personne gardée à vue le droit de demander à contacter un avocat, demande qui doit être consignée au procès-verbal de garde à vue. Conseil pratique : formulez la demande oralement et clairement, et vérifiez qu'elle est bien consignée — le procès-verbal est la pièce sur laquelle le tribunal se fondera.",
    },
    tags: ['avocat', 'محامي', 'محضر', 'PV'],
  },
  {
    id: 'gav-medecin',
    cat: 'police',
    ref: { law: 'المسطرة الجنائية / Procédure pénale', art: '73-74' },
    title: { ar: 'الفحص الطبي', fr: 'Examen médical' },
    fact: {
      ar: 'كيمكن ليك تطلب فحص طبي خلال أو بعد الحراسة النظرية. النيابة العامة ملزمة تستجيب للطلب.',
      fr: "Vous pouvez demander un examen médical pendant ou à l'issue de la garde à vue. Le parquet est tenu d'y donner suite.",
    },
    dz: 'إلى ضربوك ولا حسيتي بشي حاجة، طلب الطبيب — والطلب خصو يتكتب.',
    body: {
      ar: 'الشخص الموضوع تحت الحراسة النظرية، أو محاميه، أو عائلته، كيقدر يطلب من النيابة العامة إجراء فحص طبي. النيابة العامة كتقدر كذلك تأمر بيه تلقائيا. الفحص الطبي هو الوسيلة الأساسية لإثبات أي سوء معاملة، ولهذا خاص الطلب يتقدم فـ أقرب وقت.',
      fr: "La personne gardée à vue, son avocat ou sa famille peuvent demander au parquet un examen médical ; le parquet peut également l'ordonner d'office. L'examen médical est le principal moyen d'établir d'éventuels mauvais traitements — d'où l'importance de le demander le plus tôt possible.",
    },
    tags: ['médecin', 'طبيب', 'mauvais traitements', 'تعذيب'],
  },
  {
    id: 'perquisition-horaires',
    cat: 'police',
    ref: { law: 'المسطرة الجنائية / Procédure pénale', art: '62' },
    title: { ar: 'توقيت تفتيش المنازل', fr: 'Horaires des perquisitions' },
    fact: {
      ar: 'تفتيش المنازل ماكيبداش قبل السادسة صباحا ولا بعد التاسعة ليلا، إلا فـ حالات استثنائية نص عليها القانون.',
      fr: "Une perquisition ne peut commencer avant 6h du matin ni après 21h, sauf exceptions prévues par la loi.",
    },
    dz: 'ماعندهمش الحق يدخلو لدارك فالليل — من 6 دالصباح ل 9 دالعشية، غير باستثناءات.',
    body: {
      ar: 'كقاعدة عامة، لا يمكن الشروع فـ تفتيش منزل قبل الساعة السادسة صباحا ولا بعد الساعة التاسعة ليلا. كاينين استثناءات، منها حالة التلبس، أو طلب صادر من داخل المنزل، أو حالات خاصة نص عليها القانون. التفتيش خاصو يتم بحضور صاحب المنزل أو من ينوب عنه، وإلا بحضور شاهدين.',
      fr: "En règle générale, une perquisition ne peut débuter avant 6h ni après 21h. Des exceptions existent : flagrant délit, appel émanant de l'intérieur du domicile, ou cas particuliers prévus par la loi. La perquisition doit se dérouler en présence de l'occupant ou de son représentant, à défaut de deux témoins.",
    },
    tags: ['perquisition', 'تفتيش', 'domicile', 'منزل', 'témoins'],
  },
  {
    id: 'constitution-23',
    cat: 'police',
    ref: { law: 'دستور المملكة / Constitution 2011', art: '23' },
    title: { ar: 'لا اعتقال إلا بمقتضى القانون', fr: 'Pas de détention hors la loi' },
    fact: {
      ar: 'الدستور: لا يجوز إلقاء القبض على أي شخص ولا اعتقاله إلا فـ الحالات وطبقا للإجراءات اللي نص عليها القانون.',
      fr: "Constitution : nul ne peut être arrêté ni détenu en dehors des cas et des formes prévus par la loi.",
    },
    dz: 'الدستور كيقول: ماكاينش اعتقال خارج القانون. وأي واحد معتقل عندو الحق يسكت.',
    body: {
      ar: 'الفصل 23 من دستور 2011 كيمنع الاعتقال والاحتجاز التعسفي، وكيضمن للشخص المعتقل إخباره فورا وبكيفية يفهمها بدواعي اعتقاله وبحقوقه، ومن ضمنها حقه فـ التزام الصمت. كما كيمنع التعذيب والمعاملة القاسية أو اللاإنسانية أو المهينة، وكيعتبرها جريمة يعاقب عليها القانون.',
      fr: "L'article 23 de la Constitution de 2011 prohibe l'arrestation et la détention arbitraires. Toute personne détenue doit être informée immédiatement, d'une façon qu'elle comprend, des motifs de sa détention et de ses droits, dont celui de garder le silence. Le texte prohibe également la torture et les traitements cruels, inhumains ou dégradants, érigés en infraction punie par la loi.",
    },
    tags: ['constitution', 'دستور', 'silence', 'صمت', 'torture', 'تعذيب'],
  },
  {
    id: 'gav-registre',
    cat: 'police',
    ref: { law: 'المسطرة الجنائية / Procédure pénale', art: '66' },
    title: { ar: 'سجل الحراسة النظرية', fr: 'Le registre de garde à vue' },
    fact: {
      ar: 'ساعة بداية ونهاية الحراسة النظرية كتسجل فـ سجل خاص وفـ المحضر. قرا قبل ما توقّع.',
      fr: "Les heures de début et de fin de garde à vue sont consignées sur un registre et au PV. Lisez avant de signer.",
    },
    dz: 'ماتوقّعش على شي ورقة قبل ما تقراها. الساعات اللي مكتوبين فيها كيعنيو بزاف.',
    body: {
      ar: 'ضابط الشرطة القضائية ملزم بمسك سجل خاص بالحراسة النظرية، مرقّم وموقّع من النيابة العامة، كيتسجل فيه هوية الشخص وساعة بداية ونهاية الحراسة النظرية وساعات الاستماع. التوقيع على محضر بدون قراءته كيصعّب الطعن فيه لاحقا: من حقك تقرا المحضر وتطلب تصحيح أي معطى غير صحيح قبل التوقيع.',
      fr: "L'officier de police judiciaire tient un registre de garde à vue, coté et signé par le parquet, mentionnant l'identité de la personne, les heures de début et de fin de la mesure et celles des auditions. Signer un procès-verbal sans l'avoir lu rend sa contestation ultérieure très difficile : vous pouvez le lire et demander la rectification de toute mention inexacte avant de signer.",
    },
    tags: ['registre', 'سجل', 'signature', 'توقيع', 'PV', 'محضر'],
  },
  {
    id: 'flagrant-delit',
    cat: 'police',
    ref: { law: 'المسطرة الجنائية / Procédure pénale', art: '56' },
    title: { ar: 'حالة التلبس', fr: 'Le flagrant délit' },
    fact: {
      ar: 'حالة التلبس ليست وصفا مطاطا: القانون كيحددها بحالات ضيقة، وهي اللي كتوسع صلاحيات الضابطة القضائية.',
      fr: "Le flagrant délit n'est pas une notion élastique : la loi l'enferme dans des cas précis, et c'est lui qui élargit les pouvoirs de la police.",
    },
    dz: 'التلبس معناه القضية توقعات دابا ولا قريب. ماشي أي حاجة كيسميوها تلبس.',
    body: {
      ar: 'الجريمة كتكون فـ حالة تلبس أساسا إذا كانت فـ طور الارتكاب، أو ارتكبت فـ وقت قريب جدا، أو تم تتبع المشتبه فيه بصياح الجمهور، أو وجدت بحوزته أشياء أو آثار كتدل على مشاركته. أهمية الوصف كامنة فـ كون حالة التلبس كتوسع بشكل كبير من سلط ضابط الشرطة القضائية، خصوصا فـ التفتيش والتوقيف، ولهذا خاص التأكد من توفر شروطها.',
      fr: "L'infraction est flagrante notamment lorsqu'elle se commet actuellement, vient de se commettre, lorsque le suspect est poursuivi par la clameur publique, ou lorsqu'il est trouvé porteur d'objets ou de traces révélant sa participation. L'enjeu est considérable : la flagrance élargit fortement les pouvoirs de l'officier de police judiciaire, en particulier en matière de perquisition et d'arrestation. Ses conditions doivent donc être réunies.",
    },
    tags: ['flagrant', 'تلبس', 'pouvoirs', 'صلاحيات'],
  },

  /* ----------------------------------------------------------------- route */
  {
    id: 'route-documents',
    cat: 'route',
    ref: { law: 'مدونة السير / Code de la route', art: 'L. 52-05' },
    title: { ar: 'الوثائق المطلوبة', fr: 'Les documents à présenter' },
    fact: {
      ar: 'فـ المراقبة الطرقية خاصك: رخصة السياقة، البطاقة الرمادية، شهادة التأمين، والزيارة التقنية.',
      fr: 'Lors d\'un contrôle : permis de conduire, carte grise, attestation d\'assurance et visite technique.',
    },
    dz: 'ربع وثائق: البيرمي، الكارط كريز، الأسورونس، والفيزيت تكنيك. غير هادو.',
    body: {
      ar: 'المراقبة الطرقية كتهم أساسا هاد الوثائق الأربعة. مفيد تكون عندك نسخ مصورة ديالها فـ الهاتف كاحتياط، ولكن الأصول هي اللي معتمدة قانونيا. من حقك تعرف صفة العون اللي كيراقبك وتطلب الاطلاع على بطاقته المهنية.',
      fr: "Le contrôle porte essentiellement sur ces quatre documents. Conserver des copies photographiées sur son téléphone est utile en secours, mais seuls les originaux ont valeur légale. Vous pouvez demander à connaître la qualité de l'agent qui vous contrôle et à voir sa carte professionnelle.",
    },
    tags: ['contrôle', 'مراقبة', 'permis', 'assurance', 'تأمين'],
  },
  {
    id: 'route-quittance',
    cat: 'route',
    ref: { law: 'مدونة السير / Code de la route', art: 'Amende transactionnelle' },
    title: { ar: 'الغرامة التصالحية والوصل', fr: 'Amende transactionnelle et reçu' },
    fact: {
      ar: 'أي مبلغ كتخلصو خاصك تاخد عليه وصل رسمي. الخلاص بلا وصل ماشي غرامة — هادي رشوة.',
      fr: "Toute somme payée doit donner lieu à un reçu officiel. Un paiement sans reçu n'est pas une amende — c'est une corruption.",
    },
    dz: 'ما تخلّص حتى درهم بلا كيّة. بلا وصل، ماشي غرامة قانونية.',
    body: {
      ar: 'الغرامة التصالحية والجزافية كتخلص مقابل وصل رسمي كيسلمو العون المؤهل، وكيتضمن مبلغ الغرامة ونوع المخالفة. الوصل هو الإثبات الوحيد ديالك بلي خلصتي. المطالبة بمبلغ بدون تسليم وصل هي ممارسة غير قانونية كتشكل جريمة معاقب عليها، ويمكن التبليغ عنها لدى النيابة العامة أو الهيئة الوطنية للنزاهة.',
      fr: "L'amende transactionnelle et forfaitaire se règle contre remise d'un reçu officiel délivré par l'agent habilité, mentionnant le montant et la nature de l'infraction. Ce reçu est votre seule preuve de paiement. Exiger une somme sans délivrer de reçu est une pratique illégale, constitutive d'une infraction pénale, qui peut être signalée au parquet ou à l'Instance nationale de la probité.",
    },
    tags: ['amende', 'غرامة', 'reçu', 'وصل', 'corruption', 'رشوة'],
  },
  {
    id: 'route-refus-transaction',
    cat: 'route',
    ref: { law: 'مدونة السير / Code de la route', art: 'Transaction' },
    title: { ar: 'الحق فـ رفض المصالحة', fr: 'Droit de refuser la transaction' },
    fact: {
      ar: 'المصالحة اختيارية: إلى شفتي بلي المخالفة ماشي صحيحة، كيمكن ليك ترفض وتحال القضية على المحكمة.',
      fr: "La transaction est facultative : si vous contestez l'infraction, vous pouvez refuser et faire trancher l'affaire par le tribunal.",
    },
    dz: 'إلى ماكنتيش متافق مع المخالفة، عندك الحق ترفض تصالح وتمشي للمحكمة.',
    body: {
      ar: 'الغرامة التصالحية هي عرض للتسوية الودية، وأداؤها كيعني الاعتراف الضمني بالمخالفة وكيسقط حقك فـ المنازعة. إلى كنتي كتشوف بلي المخالفة غير مبررة، من حقك ترفض المصالحة؛ فـ هاد الحالة كيحرر محضر وتحال القضية على المحكمة المختصة اللي هي اللي كتبت. خذ بعين الاعتبار بلي المحكمة يمكن تحكم بغرامة أعلى.',
      fr: "L'amende transactionnelle est une proposition de règlement amiable : la payer vaut reconnaissance implicite de l'infraction et vous prive de tout recours. Si vous estimez l'infraction injustifiée, vous pouvez refuser la transaction ; un procès-verbal est alors dressé et l'affaire renvoyée devant le tribunal compétent, qui tranche. À noter : le tribunal peut prononcer une amende supérieure.",
    },
    tags: ['contestation', 'منازعة', 'tribunal', 'محكمة'],
  },
  {
    id: 'route-permis-points',
    cat: 'route',
    ref: { law: 'مدونة السير / Code de la route', art: 'Permis à points' },
    title: { ar: 'رخصة السياقة بالنقط', fr: 'Le permis à points' },
    fact: {
      ar: 'رخصة السياقة عندها رصيد ديال 30 نقطة. كل مخالفة كتنقص نقط، وملي كيوصل الرصيد لصفر كتلغى الرخصة.',
      fr: 'Le permis dispose d\'un capital de 30 points. Chaque infraction en retire ; à zéro, le permis est annulé.',
    },
    dz: '30 نقطة فالبيرمي. كل مخالفة كتاكل شي نقط، وملي تسالي كيتلغى.',
    body: {
      ar: 'نظام النقط كيربط الاحتفاظ بالرخصة بالسلوك ديال السائق: كل رخصة عندها رصيد أولي ديال 30 نقطة، وعدد النقط المسحوبة كيختلف حسب خطورة المخالفة. الرصيد كيمكن يسترجع بعد مرور مدة بلا مخالفات أو عبر التكوين. كيمكن ليك تستافسر على الرصيد ديالك لدى الإدارة المختصة.',
      fr: "Le permis à points lie sa conservation au comportement du conducteur : chaque permis dispose d'un capital initial de 30 points, le nombre de points retirés variant selon la gravité de l'infraction. Le capital peut être reconstitué après une période sans infraction ou par une formation. Vous pouvez consulter votre solde de points auprès de l'administration compétente.",
    },
    tags: ['points', 'نقط', 'permis', 'رخصة'],
  },
  {
    id: 'route-vitesse',
    cat: 'route',
    ref: { law: 'مدونة السير / Code de la route', art: 'Vitesse' },
    title: { ar: 'السرعة القصوى', fr: 'Vitesses maximales' },
    fact: {
      ar: 'السرعة القصوى: 60 كلم/س داخل المدار الحضري، 100 خارجو، و120 فـ الطريق السيار، إلا إلا كانت إشارة مخالفة.',
      fr: 'Vitesses : 60 km/h en agglomération, 100 hors agglomération, 120 sur autoroute, sauf signalisation contraire.',
    },
    dz: '60 فالمدينة، 100 برا، 120 فالوطوروت — إلا كانت شي علامة أخرى، كتغلب هي.',
    body: {
      ar: 'هادي هي الحدود العامة، ولكن الإشارة الطرقية الموجودة فـ عين المكان هي اللي كتغلب دائما، سواء خفضات ولا رفعات. كاينة كذلك حدود خاصة أقل بالنسبة لبعض أصناف المركبات (الشاحنات، الحافلات، السائقين الجدد). تجاوز السرعة كيرتب غرامة وسحب نقط، وكيمكن يوصل للحجز فـ حالات التجاوز الكبير.',
      fr: "Ce sont les limites générales, mais la signalisation présente sur place prime toujours, qu'elle abaisse ou relève la limite. Des limites spécifiques, inférieures, s'appliquent à certaines catégories de véhicules (poids lourds, autocars) et aux conducteurs novices. L'excès de vitesse entraîne amende et retrait de points, et peut conduire à l'immobilisation en cas de dépassement important.",
    },
    tags: ['vitesse', 'سرعة', 'radar', 'رادار'],
  },
  {
    id: 'route-ceinture',
    cat: 'route',
    ref: { law: 'مدونة السير / Code de la route', art: 'Équipements' },
    title: { ar: 'حزام الأمان والخوذة', fr: 'Ceinture et casque' },
    fact: {
      ar: 'حزام الأمان إجباري على جميع الركاب، قدام ومورا. والخوذة إجبارية على سائق وراكب الدراجة النارية.',
      fr: 'La ceinture est obligatoire pour tous les passagers, avant comme arrière. Le casque l\'est pour tout deux-roues.',
    },
    dz: 'السانتير على الكل، حتى اللي مورا. والكاسك على البيكالة إجباري.',
    body: {
      ar: 'الإلزام كيهم السائق وجميع الركاب، بما فيهم اللي فـ المقاعد الخلفية. بالنسبة للأطفال كاينة قواعد خاصة كتمنع نقلهم فـ المقعد الأمامي تحت سن معينة وكتفرض وسائل تثبيت ملائمة. عدم ارتداء الحزام أو الخوذة كيرتب غرامة وسحب نقط، وفوق هادشي كيضاعف خطر الوفاة فـ حالة الحادث.',
      fr: "L'obligation vise le conducteur et l'ensemble des passagers, y compris à l'arrière. Des règles particulières encadrent le transport des enfants, interdisant la place avant en dessous d'un certain âge et imposant des dispositifs de retenue adaptés. Le défaut de ceinture ou de casque entraîne amende et retrait de points — et surtout multiplie le risque de décès en cas d'accident.",
    },
    tags: ['ceinture', 'حزام', 'casque', 'خوذة', 'enfants'],
  },
  {
    id: 'route-telephone',
    cat: 'route',
    ref: { law: 'مدونة السير / Code de la route', art: 'Conduite' },
    title: { ar: 'الهاتف أثناء السياقة', fr: 'Téléphone au volant' },
    fact: {
      ar: 'استعمال الهاتف باليد أثناء السياقة ممنوع وكيرتب غرامة وسحب نقط من الرخصة.',
      fr: "L'usage du téléphone tenu en main au volant est interdit : amende et retrait de points.",
    },
    dz: 'التيليفون فاليد وانت كتسوق ممنوع. حط كيت ولا حبس.',
    body: {
      ar: 'المنع كيهم الإمساك بالهاتف باليد أثناء السياقة. القانون كيعتبرها مخالفة مستقلة بذاتها، ماشي غير ملي كتسبب حادث. الحل العملي هو استعمال نظام كيخليك ماتحبسش الهاتف، أو الوقوف فـ مكان مسموح فيه بالوقوف قبل ما تجاوب.',
      fr: "L'interdiction vise le fait de tenir un téléphone en main en conduisant. Il s'agit d'une infraction autonome, indépendamment de tout accident. La solution pratique est un dispositif mains libres, ou l'arrêt du véhicule dans un endroit où le stationnement est autorisé avant de répondre.",
    },
    tags: ['téléphone', 'هاتف', 'distraction'],
  },
  {
    id: 'route-pv-force',
    cat: 'route',
    ref: { law: 'مدونة السير / Code de la route', art: 'Procès-verbal' },
    title: { ar: 'قوة إثبات المحضر', fr: 'La force probante du PV' },
    fact: {
      ar: 'محضر المخالفة كيبقى معتمد حتى يثبت العكس. تأكد من صحة المعطيات المكتوبة فيه قبل ما توقّع.',
      fr: "Le PV fait foi jusqu'à preuve contraire. Vérifiez l'exactitude des mentions avant de signer.",
    },
    dz: 'المحضر كيبقى صحيح حتى تثبت العكس. قرا مزيان قبل التوقيع.',
    body: {
      ar: 'المحاضر المحررة من طرف الأعوان المؤهلين كتكون لها حجية إلى حين إثبات العكس. عمليا، هادشي كيعني بلي عبء الإثبات كيكون عليك أنت. لهذا خاصك تتحقق من المعطيات: التاريخ، الساعة، المكان، رقم التسجيل، ونوع المخالفة. إلى لقيتي معطى غلط، طلب تصحيحو قبل التوقيع، ولا سجل تحفظك.',
      fr: "Les procès-verbaux dressés par les agents habilités font foi jusqu'à preuve contraire. Concrètement, la charge de la preuve pèse sur vous. Vérifiez donc les mentions : date, heure, lieu, immatriculation, nature de l'infraction. Si une mention est erronée, demandez sa rectification avant de signer, ou faites consigner vos réserves.",
    },
    tags: ['PV', 'محضر', 'preuve', 'إثبات'],
  },

  /* --------------------------------------------------------------- travail */
  {
    id: 'travail-contrat-ecrit',
    cat: 'travail',
    ref: { law: 'مدونة الشغل / Code du travail', art: '15 & 18' },
    title: { ar: 'عقد الشغل المكتوب', fr: 'Le contrat écrit' },
    fact: {
      ar: 'ملي كيكون عقد الشغل مكتوب، خاصو يتحرر فـ نظيرين موقعين ومصادق عليهما، ونسخة كتبقى عندك أنت.',
      fr: "Lorsqu'il est écrit, le contrat est établi en deux exemplaires signés et légalisés, dont un vous revient.",
    },
    dz: 'إلى كتب ليك الكونطرا، خصك تاخد نسخة موقعة ومصادق عليها. ماتخليهاش عندو.',
    body: {
      ar: 'العقد المكتوب كيتحرر فـ نظيرين موقعين من الطرفين ومصادق على صحة إمضائهما، وكل طرف كياخد نسخة. غياب العقد المكتوب ماكيلغيش العلاقة الشغلية: هي كتبقى قائمة وكتثبت بجميع وسائل الإثبات (الشهود، تحويلات الأجرة، تصريح الصندوق الوطني للضمان الاجتماعي). الاحتفاظ بالنسخة ديالك هو أول حماية عملية.',
      fr: "Le contrat écrit est établi en deux exemplaires signés par les parties, dont les signatures sont légalisées ; chaque partie en conserve un. L'absence d'écrit n'anéantit pas la relation de travail : elle subsiste et se prouve par tous moyens (témoignages, virements de salaire, déclaration à la CNSS). Conserver votre exemplaire est la première protection concrète.",
    },
    tags: ['contrat', 'عقد', 'CDI', 'CDD'],
  },
  {
    id: 'travail-duree',
    cat: 'travail',
    ref: { law: 'مدونة الشغل / Code du travail', art: '184' },
    title: { ar: 'مدة الشغل الأسبوعية', fr: 'Durée du travail' },
    fact: {
      ar: 'فـ الأنشطة غير الفلاحية، مدة الشغل العادية هي 44 ساعة فـ الأسبوع، أي 2288 ساعة فـ السنة.',
      fr: 'Dans les activités non agricoles, la durée normale de travail est de 44 heures par semaine, soit 2288 heures par an.',
    },
    dz: '44 ساعة فالسيمانة. اللي زايد على هادشي خاصو يتخلص كساعات إضافية.',
    body: {
      ar: 'المدة العادية محددة فـ 2288 ساعة فـ السنة أو 44 ساعة فـ الأسبوع بالنسبة للأنشطة غير الفلاحية، وكيمكن توزع على السنة بشرط ماتفوتش 10 ساعات فـ اليوم. الساعات المنجزة فوق هاد المدة هي ساعات إضافية كتخلص بزيادة محددة قانونا، وهاد الزيادة كترتفع فـ الليل وفـ أيام العطل.',
      fr: "La durée normale est fixée à 2288 heures par an ou 44 heures par semaine pour les activités non agricoles, répartissables sur l'année sans dépasser 10 heures par jour. Les heures effectuées au-delà sont des heures supplémentaires, payées avec une majoration fixée par la loi, majoration renforcée la nuit et les jours fériés.",
    },
    tags: ['heures', 'ساعات', 'supplémentaires', 'ساعات إضافية'],
  },
  {
    id: 'travail-conge',
    cat: 'travail',
    ref: { law: 'مدونة الشغل / Code du travail', art: '231' },
    title: { ar: 'العطلة السنوية المؤدى عنها', fr: 'Congé annuel payé' },
    fact: {
      ar: 'بعد 6 شهور من الشغل المتواصل، كيحق ليك يوم ونصف من العطلة المؤدى عنها على كل شهر شغل.',
      fr: "Après 6 mois de travail continu, vous avez droit à 1,5 jour de congé payé par mois travaillé.",
    },
    dz: 'من بعد 6 شهور، كل شهر كيعطيك يوم ونص ديال العطلة مخلصة.',
    body: {
      ar: 'كل أجير اشتغل ستة أشهر متصلة فـ نفس المقاولة كيستفيد من عطلة سنوية مؤدى عنها بحساب يوم ونصف من الشغل الفعلي عن كل شهر، أي حوالي 18 يوم فـ السنة. هاد المدة كتزاد بيوم ونصف عن كل خمس سنوات من الأقدمية. التخلي عن العطلة مقابل تعويض ماشي مسموح بيه كقاعدة.',
      fr: "Tout salarié justifiant de six mois de service continu dans la même entreprise a droit à un congé annuel payé de 1,5 jour ouvrable par mois de travail effectif, soit environ 18 jours par an. Cette durée est augmentée de 1,5 jour par tranche de cinq ans d'ancienneté. Renoncer au congé contre une indemnité n'est en principe pas admis.",
    },
    tags: ['congé', 'عطلة', 'vacances', 'ancienneté'],
  },
  {
    id: 'travail-licenciement-audition',
    cat: 'travail',
    ref: { law: 'مدونة الشغل / Code du travail', art: '62' },
    title: { ar: 'الاستماع قبل الفصل', fr: "L'audition avant licenciement" },
    fact: {
      ar: 'قبل الفصل بسبب خطأ جسيم، خاص المشغل يستمع ليك داخل 8 أيام، بحضور مندوب الأجراء أو ممثل نقابي.',
      fr: "Avant tout licenciement pour faute grave, l'employeur doit vous entendre dans les 8 jours, en présence d'un délégué des salariés.",
    },
    dz: 'ماعندوش الحق يطردك على طول. خصو يستمع ليك، وبحضور مندوب.',
    body: {
      ar: 'المشغل ملزم يستمع للأجير قبل فصله، داخل أجل ثمانية أيام من تاريخ ثبوت الفعل المنسوب إليه، بحضور مندوب الأجراء أو الممثل النقابي اللي كيختارو الأجير. كيحرر محضر بهاد الاستماع كيوقعو الطرفان وكيسلم نظير للأجير. عدم احترام هاد المسطرة كيجعل الفصل تعسفيا حتى ولو كان الخطأ ثابت.',
      fr: "L'employeur doit entendre le salarié avant de le licencier, dans un délai de huit jours à compter de la constatation des faits reprochés, en présence du délégué des salariés ou du représentant syndical choisi par le salarié. Un procès-verbal est dressé, signé par les deux parties, et un exemplaire remis au salarié. Le non-respect de cette procédure rend le licenciement abusif, même si la faute est établie.",
    },
    tags: ['licenciement', 'فصل', 'faute grave', 'خطأ جسيم', 'délégué'],
  },
  {
    id: 'travail-indemnite',
    cat: 'travail',
    ref: { law: 'مدونة الشغل / Code du travail', art: '52-53' },
    title: { ar: 'تعويض الفصل', fr: 'Indemnité de licenciement' },
    fact: {
      ar: 'الأجير اللي عندو 6 شهور من الأقدمية كيستحق تعويضا عن الفصل، محسوب بالساعات على كل سنة من الشغل.',
      fr: "Le salarié comptant 6 mois d'ancienneté a droit à une indemnité de licenciement, calculée en heures par année de service.",
    },
    dz: 'من 6 شهور وفوق، عندك الحق فتعويض ملي كيطردوك — وكيتحسب بالأقدمية.',
    body: {
      ar: 'التعويض عن الفصل كيستحقو الأجير المرتبط بعقد غير محدد المدة اللي عندو على الأقل ستة أشهر من الأقدمية، ما عدا فـ حالة الخطأ الجسيم. كيتحسب على أساس عدد ساعات من الأجر عن كل سنة من الشغل الفعلي، وهاد العدد كيرتفع كلما زادت الأقدمية. وكيضاف ليه، حسب الحالة، التعويض عن أجل الإخطار والتعويض عن الضرر إلا كان الفصل تعسفيا.',
      fr: "L'indemnité de licenciement est due au salarié lié par un contrat à durée indéterminée justifiant d'au moins six mois d'ancienneté, sauf faute grave. Elle se calcule en nombre d'heures de salaire par année de travail effectif, ce nombre augmentant avec l'ancienneté. S'y ajoutent, selon les cas, l'indemnité de préavis et des dommages-intérêts si le licenciement est abusif.",
    },
    tags: ['indemnité', 'تعويض', 'ancienneté', 'أقدمية'],
  },
  {
    id: 'travail-cnss',
    cat: 'travail',
    ref: { law: 'الضمان الاجتماعي / Sécurité sociale', art: 'Régime CNSS' },
    title: { ar: 'التصريح لدى الصندوق الوطني للضمان الاجتماعي', fr: 'La déclaration à la CNSS' },
    fact: {
      ar: 'التصريح بك لدى CNSS إجباري على المشغل من أول يوم ديال الشغل، وماشي اختياري ولا مرتبط بموافقتك.',
      fr: "Votre déclaration à la CNSS est une obligation de l'employeur dès le premier jour, pas une option.",
    },
    dz: 'الكنص ماشي فضل من الباطرون — واجب عليه من نهار اللول ديال الخدمة.',
    body: {
      ar: 'كل مشغل ملزم بالتسجيل لدى الصندوق الوطني للضمان الاجتماعي والتصريح بأجرائه وبأجورهم الحقيقية. عدم التصريح، أو التصريح بأجرة أقل من الحقيقية، كيحرمك من التغطية الصحية ومن التعويضات ومن احتساب سنوات التقاعد. كيمكن ليك تتحقق من وضعيتك مباشرة لدى الصندوق، وتقدم شكاية إلى مفتشية الشغل إلى تبين بلي ماكنتيش مصرح بيك.',
      fr: "Tout employeur est tenu de s'affilier à la CNSS et d'y déclarer ses salariés ainsi que leurs salaires réels. L'absence de déclaration, ou une déclaration minorée, vous prive de couverture médicale, d'indemnités et de trimestres de retraite. Vous pouvez vérifier votre situation directement auprès de la Caisse et saisir l'inspection du travail si vous constatez un défaut de déclaration.",
    },
    tags: ['CNSS', 'ضمان اجتماعي', 'retraite', 'تقاعد', 'inspection'],
  },
  {
    id: 'travail-maternite',
    cat: 'travail',
    ref: { law: 'مدونة الشغل / Code du travail', art: '152-153' },
    title: { ar: 'عطلة الولادة', fr: 'Congé de maternité' },
    fact: {
      ar: 'الأجيرة كتستافد من عطلة الولادة مدتها 14 أسبوع، والفصل بسبب الحمل أو الولادة ممنوع.',
      fr: 'La salariée bénéficie d\'un congé de maternité de 14 semaines ; le licenciement pour cause de grossesse est interdit.',
    },
    dz: '14 سيمانة ديال عطلة الولادة، وماعندوش الحق يطردها على قبل الحمل.',
    body: {
      ar: 'مدة عطلة الأمومة هي أربعتاش أسبوع، إلا كان كاين شرط أفضل فـ عقد الشغل أو الاتفاقية الجماعية. المشغل ماعندوش الحق يفصل الأجيرة بسبب حالة الحمل أو الولادة، ولا خلال فترة العطلة. كما كيحق للأم بعد رجوعها استراحة خاصة يومية للرضاعة خلال المدة المحددة قانونا.',
      fr: "Le congé de maternité est de quatorze semaines, sauf disposition plus favorable du contrat ou de la convention collective. L'employeur ne peut licencier la salariée en raison de son état de grossesse ou de son accouchement, ni pendant la durée du congé. À son retour, la mère bénéficie en outre d'un repos quotidien d'allaitement pendant la période fixée par la loi.",
    },
    tags: ['maternité', 'ولادة', 'grossesse', 'حمل', 'allaitement'],
  },
  {
    id: 'travail-inspection',
    cat: 'travail',
    ref: { law: 'مدونة الشغل / Code du travail', art: '532 et s.' },
    title: { ar: 'مفتشية الشغل', fr: "L'inspection du travail" },
    fact: {
      ar: 'كيمكن ليك تقدم شكاية لمفتشية الشغل مجانا، وهي كتقوم بمحاولة الصلح قبل اللجوء للمحكمة.',
      fr: "Vous pouvez saisir gratuitement l'inspection du travail, qui tente une conciliation avant le tribunal.",
    },
    dz: 'مفتشية الشغل بلا فلوس. سير عندهم قبل ما تمشي للمحكمة.',
    body: {
      ar: 'مفتش الشغل كيسهر على تطبيق مدونة الشغل وكيقوم بمهام المراقبة والتحقيق والصلح. تقديم الشكاية مجاني وكيمكن يتم كتابة. محاولة الصلح كتنتهي بمحضر: إلى كان الصلح كليا، المحضر كيكتسب قوة تنفيذية؛ وإلا كتبقى ليك إمكانية اللجوء للمحكمة الابتدائية قسم القضاء الاجتماعي. تنبيه مهم: دعاوى الفصل كتخضع لآجال قصيرة، فماتسناش بزاف.',
      fr: "L'inspecteur du travail veille à l'application du code du travail et exerce des missions de contrôle, d'enquête et de conciliation. La saisine est gratuite et peut se faire par écrit. La tentative de conciliation donne lieu à un procès-verbal : en cas d'accord total, il acquiert force exécutoire ; à défaut, la voie du tribunal de première instance, section sociale, reste ouverte. Attention : les actions relatives au licenciement obéissent à des délais courts — n'attendez pas.",
    },
    tags: ['inspection', 'مفتشية', 'conciliation', 'صلح', 'tribunal'],
  },

  /* --------------------------------------------------------------- famille */
  {
    id: 'famille-age',
    cat: 'famille',
    ref: { law: 'مدونة الأسرة / Code de la famille', art: '19' },
    title: { ar: 'سن الزواج', fr: 'Âge du mariage' },
    fact: {
      ar: 'أهلية الزواج كتكتمل بـ 18 سنة شمسية كاملة، بالنسبة للرجل والمرأة على حد سواء.',
      fr: "La capacité matrimoniale s'acquiert à 18 années grégoriennes révolues, pour l'homme comme pour la femme.",
    },
    dz: '18 عام هي السن ديال الزواج، للراجل وللمرا بحال بحال.',
    body: {
      ar: 'المادة 19 كتحدد سن الأهلية للزواج فـ ثمنطاش سنة شمسية كاملة للجنسين. القاعدة عامة، وأي زواج تحت هاد السن كيبقى استثناء كيتطلب إذنا قضائيا معللا وفق شروط محددة. الزواج غير الموثق كيطرح مشاكل خطيرة فـ إثبات النسب والحقوق، ولهذا التوثيق ماشي شكليات.',
      fr: "L'article 19 fixe la capacité matrimoniale à dix-huit années grégoriennes révolues pour les deux sexes. La règle est générale : tout mariage en deçà demeure une exception soumise à une autorisation judiciaire motivée dans des conditions déterminées. Le mariage non documenté crée de graves difficultés de preuve, en matière de filiation notamment — l'enregistrement n'est pas une formalité.",
    },
    tags: ['mariage', 'زواج', 'âge', 'سن'],
  },
  {
    id: 'famille-mineur',
    cat: 'famille',
    ref: { law: 'مدونة الأسرة / Code de la famille', art: '20-21' },
    title: { ar: 'الإذن بزواج القاصر', fr: 'Autorisation du mariage du mineur' },
    fact: {
      ar: 'زواج القاصر ماكيمكنش بلا إذن قضائي معلل، وخاص موافقة النائب الشرعي وحضوره.',
      fr: "Le mariage d'un mineur suppose une autorisation judiciaire motivée et l'accord du représentant légal.",
    },
    dz: 'بلا إذن ديال القاضي، ماكاينش زواج القاصر. والقرار خصو يكون معلل.',
    body: {
      ar: 'قاضي الأسرة المكلف بالزواج كيقدر يأذن بزواج من هو دون سن الأهلية بمقرر معلل كيبين فيه المصلحة والأسباب المبررة، بعد الاستماع لأبوي القاصر أو نائبه الشرعي والاستعانة بخبرة طبية أو بحث اجتماعي. الإذن كيتوقف كذلك على موافقة النائب الشرعي وحضوره فـ العقد. المقرر المأذون بيه ماكيقبلش الطعن.',
      fr: "Le juge de la famille chargé du mariage peut autoriser le mariage d'une personne n'ayant pas atteint la capacité matrimoniale par décision motivée exposant l'intérêt et les motifs, après audition des parents ou du représentant légal du mineur et recours à une expertise médicale ou à une enquête sociale. L'autorisation suppose aussi le consentement du représentant légal et sa présence à l'acte. La décision d'autorisation n'est pas susceptible de recours.",
    },
    tags: ['mineur', 'قاصر', 'juge', 'قاضي'],
  },
  {
    id: 'famille-polygamie',
    cat: 'famille',
    ref: { law: 'مدونة الأسرة / Code de la famille', art: '40-41' },
    title: { ar: 'التعدد', fr: 'La polygamie' },
    fact: {
      ar: 'التعدد ممنوع إلا خيف عدم العدل بين الزوجات، وكيتطلب إذنا من المحكمة ماكيتعطاش بسهولة.',
      fr: "La polygamie est interdite s'il y a risque d'iniquité entre les épouses, et suppose une autorisation du tribunal.",
    },
    dz: 'التعدد ماشي حق مطلق: خصو إذن من المحكمة، وممنوع إلى كان خوف من عدم العدل.',
    body: {
      ar: 'التعدد ممنوع إذا خيف عدم العدل بين الزوجات، وكذلك إذا اشترطت الزوجة على زوجها عدم التزوج عليها. وحتى فـ غياب هاد الشرط، ماكيمكنش التعدد إلا بإذن من المحكمة، اللي كتتحقق من وجود مبرر موضوعي استثنائي ومن قدرة الزوج على إعالة الأسرتين وضمان جميع الحقوق. المحكمة كتستدعي الزوجة الأولى وكتخبرها.',
      fr: "La polygamie est interdite lorsqu'une iniquité entre les épouses est à craindre, ainsi que lorsque l'épouse a stipulé dans l'acte que son mari ne prendra pas d'autre épouse. Même en l'absence d'une telle clause, elle n'est possible que sur autorisation du tribunal, qui vérifie l'existence d'un motif objectif exceptionnel et la capacité du mari à entretenir les deux foyers et à garantir tous les droits. Le tribunal convoque et informe la première épouse.",
    },
    tags: ['polygamie', 'تعدد', 'autorisation', 'إذن'],
  },
  {
    id: 'famille-biens',
    cat: 'famille',
    ref: { law: 'مدونة الأسرة / Code de la famille', art: '49' },
    title: { ar: 'الأموال المكتسبة أثناء الزواج', fr: 'Les biens acquis pendant le mariage' },
    fact: {
      ar: 'القاعدة هي استقلال الذمة المالية، ولكن كيمكن للزوجين يتفقو فـ وثيقة مستقلة على تدبير الأموال المكتسبة.',
      fr: "Le régime de principe est la séparation des biens, mais les époux peuvent convenir, dans un document distinct, de la gestion des biens acquis.",
    },
    dz: 'كل واحد وماليتو. ولكن كيمكن تكتبو ورقة مستقلة على الأموال اللي غادي تجمعو مع بعضياتكم.',
    body: {
      ar: 'لكل واحد من الزوجين ذمة مالية مستقلة عن ذمة الآخر. غير أن للزوجين أن يتفقا على إطار لتدبير الأموال اللي غادي يكتسبوها خلال الزواج، وهاد الاتفاق كيوثق فـ وثيقة مستقلة عن عقد الزواج. عند غياب الاتفاق، كترجع القواعد العامة للإثبات، وكتاخد المحكمة بعين الاعتبار عمل كل واحد من الزوجين ومجهوداته وما تحملو من أعباء لتنمية أموال الأسرة.',
      fr: "Chacun des époux dispose d'un patrimoine distinct de celui de l'autre. Les époux peuvent toutefois se mettre d'accord sur le cadre de gestion des biens qu'ils acquerront pendant le mariage, cet accord étant consigné dans un document séparé de l'acte de mariage. À défaut, il est fait recours aux règles générales de preuve, le tribunal tenant compte du travail de chaque époux, de ses efforts et des charges qu'il a assumées pour développer les biens de la famille.",
    },
    tags: ['biens', 'أموال', 'séparation', 'ذمة مالية'],
  },
  {
    id: 'famille-talaq-judiciaire',
    cat: 'famille',
    ref: { law: 'مدونة الأسرة / Code de la famille', art: '78-79' },
    title: { ar: 'الطلاق تحت مراقبة القضاء', fr: 'Le divorce sous contrôle judiciaire' },
    fact: {
      ar: 'الطلاق ماكيمكنش يوقع خارج المحكمة: خاص إذن من المحكمة قبل توثيقه، وكاينة محاولة صلح إجبارية.',
      fr: "Le divorce ne peut être prononcé hors du tribunal : une autorisation judiciaire est requise, précédée d'une tentative de conciliation.",
    },
    dz: 'الطلاق كيدوز غير عند المحكمة. ماكاينش طلاق فالدار ولا فالتيليفون.',
    body: {
      ar: 'الطلاق كيمارس تحت مراقبة القضاء: خاص طلب الإذن من المحكمة، وهي كتستدعي الزوجين وكتقوم بمحاولة الإصلاح. المحكمة كتحدد كذلك مستحقات الزوجة والأولاد قبل الإذن بالتوثيق، وماكيمكنش التوثيق قبل أداء هاد المستحقات. أي طلاق واقع خارج هاد المسطرة ماكيرتبش الآثار القانونية المرتبطة بالطلاق الموثق.',
      fr: "Le divorce s'exerce sous contrôle judiciaire : une autorisation doit être demandée au tribunal, qui convoque les époux et procède à une tentative de conciliation. Le tribunal fixe également les droits dus à l'épouse et aux enfants avant d'autoriser l'établissement de l'acte, lequel ne peut intervenir avant leur consignation. Un divorce prononcé hors de cette procédure ne produit pas les effets juridiques attachés au divorce documenté.",
    },
    tags: ['divorce', 'طلاق', 'conciliation', 'صلح', 'tribunal'],
  },
  {
    id: 'famille-chiqaq',
    cat: 'famille',
    ref: { law: 'مدونة الأسرة / Code de la famille', art: '94-97' },
    title: { ar: 'التطليق للشقاق', fr: 'Le divorce pour discorde (chiqaq)' },
    fact: {
      ar: 'كل واحد من الزوجين كيقدر يطلب التطليق للشقاق، بلا ما يكون مجبور يثبت خطأ الطرف الآخر.',
      fr: "Chacun des époux peut demander le divorce pour discorde, sans avoir à prouver une faute de l'autre.",
    },
    dz: 'الشقاق: كيمكن للراجل ولا للمرا يطلب التطليق بلا ما يثبت غلطة ديال الآخر.',
    body: {
      ar: 'إذا طلب أحد الزوجين أو هما بجوج فض النزاع الناشب بينهما، كتقوم المحكمة بمحاولة الإصلاح، وكيمكن تنتدب حكمين أو مجلس العائلة أو من تراه مؤهلا. وإلا تعذر الإصلاح، كتثبت المحكمة ذلك فـ محضر وكتحكم بالتطليق مع تحديد المستحقات، مع مراعاة مسؤولية كل طرف عن سبب الفراق فـ تقدير التعويض. المسطرة كتخضع لأجل زمني محدد قانونا.',
      fr: "Lorsque l'un des époux, ou les deux, demandent au tribunal de régler un différend les opposant, celui-ci procède à une tentative de conciliation et peut désigner deux arbitres, le conseil de famille ou toute personne qu'il juge qualifiée. Si la conciliation échoue, le tribunal le constate par procès-verbal et prononce le divorce en fixant les droits dus, en tenant compte de la responsabilité de chaque partie dans la cause de la séparation pour l'évaluation de l'indemnisation. La procédure est enfermée dans un délai fixé par la loi.",
    },
    tags: ['chiqaq', 'شقاق', 'divorce', 'تطليق', 'arbitres'],
  },
  {
    id: 'famille-hadana',
    cat: 'famille',
    ref: { law: 'مدونة الأسرة / Code de la famille', art: '171' },
    title: { ar: 'ترتيب مستحقي الحضانة', fr: "L'ordre des titulaires de la garde" },
    fact: {
      ar: 'الحضانة كتخول للأم أولا، ثم للأب، ثم لأم الأم، مع مراعاة مصلحة المحضون فـ جميع الأحوال.',
      fr: "La garde revient d'abord à la mère, puis au père, puis à la grand-mère maternelle, l'intérêt de l'enfant primant.",
    },
    dz: 'الحضانة: الأم أولا، من بعد الأب، من بعد أم الأم. ومصلحة الولد فوق كلشي.',
    body: {
      ar: 'الحضانة كتخول للأم، ثم للأب، ثم لأم الأم. وإذا تعذر ذلك كتبت المحكمة بناء على مصلحة المحضون. المعيار الحاسم فـ جميع القرارات المتعلقة بالحضانة هو مصلحة الطفل الفضلى، وهي اللي كتقدرها المحكمة بالنظر لظروف كل حالة. سقوط الحضانة عن مستحقها ماكيوقعش تلقائيا: خاص مقرر قضائي.',
      fr: "La garde est confiée à la mère, puis au père, puis à la grand-mère maternelle. À défaut, le tribunal statue en considération de l'intérêt de l'enfant. Ce critère de l'intérêt supérieur de l'enfant est déterminant dans toute décision relative à la garde et s'apprécie au regard des circonstances propres à chaque affaire. La déchéance de la garde n'est jamais automatique : elle suppose une décision judiciaire.",
    },
    tags: ['garde', 'حضانة', 'enfant', 'محضون'],
  },
  {
    id: 'famille-choix-15',
    cat: 'famille',
    ref: { law: 'مدونة الأسرة / Code de la famille', art: '166' },
    title: { ar: 'اختيار الطفل بعد 15 سنة', fr: "Le choix de l'enfant à 15 ans" },
    fact: {
      ar: 'ملي كيوصل الطفل لـ 15 سنة، كيحق ليه يختار من يحضنه من بين أبويه أو الأقارب.',
      fr: "À 15 ans révolus, l'enfant peut choisir lequel de ses parents ou proches assurera sa garde.",
    },
    dz: 'من 15 عام وفوق، الولد هو اللي كيختار عند مين يقعد.',
    body: {
      ar: 'الحضانة كتستمر إلى بلوغ سن الرشد القانوني بالنسبة للذكر والأنثى. ومع ذلك، ملي كيتم المحضون خمسطاش سنة كيصبح ليه الحق يختار من يحضنه من أبيه أو أمه، وعند عدم وجودهما كيمكن ليه يختار أحد أقاربه المنصوص عليهم قانونا، شريطة ما يتنافاش هاد الاختيار مع مصلحته. الاختيار كيمارس أمام المحكمة.',
      fr: "La garde se poursuit jusqu'à la majorité légale de l'enfant, garçon ou fille. Toutefois, à quinze ans révolus, l'enfant peut choisir celui de ses parents qui en assurera la garde et, à défaut de ceux-ci, l'un des proches désignés par la loi, sous réserve que ce choix ne soit pas contraire à son intérêt. Le choix s'exerce devant le tribunal.",
    },
    tags: ['choix', 'اختيار', '15 ans', 'garde'],
  },
  {
    id: 'famille-nafaqa',
    cat: 'famille',
    ref: { law: 'مدونة الأسرة / Code de la famille', art: '198-199' },
    title: { ar: 'النفقة على الأبناء', fr: "L'obligation d'entretien" },
    fact: {
      ar: 'نفقة الأولاد واجبة على الأب، وماكتسقطش بالطلاق. عدم الأداء كيمكن يعرض للمتابعة.',
      fr: "L'entretien des enfants incombe au père et ne s'éteint pas avec le divorce ; le défaut de paiement est sanctionné.",
    },
    dz: 'النفقة ديال الدراري واجبة على الأب حتى من بعد الطلاق. وماكاينش تهرب منها.',
    body: {
      ar: 'نفقة الأولاد واجبة على الأب إلى أن يبلغ الأولاد سن الرشد أو خمسة وعشرين سنة بالنسبة للمستمرين فـ الدراسة، ومستمرة بالنسبة للبنت إلى أن تتوفر على كسب أو تجب نفقتها على زوجها، وبالنسبة للولد المعاق العاجز عن الكسب. الطلاق ماكيسقطش هاد الالتزام. عدم أداء النفقة المحكوم بها كيعرض لمساطر التنفيذ، وكيمكن يشكل جريمة إهمال الأسرة.',
      fr: "L'entretien des enfants incombe au père jusqu'à la majorité, ou jusqu'à vingt-cinq ans pour ceux qui poursuivent leurs études ; il se poursuit pour la fille jusqu'à ce qu'elle dispose de ressources ou que son entretien incombe à son mari, et pour l'enfant handicapé hors d'état de subvenir à ses besoins. Le divorce n'éteint pas cette obligation. Le non-paiement de la pension judiciairement fixée expose aux voies d'exécution et peut constituer le délit d'abandon de famille.",
    },
    tags: ['pension', 'نفقة', 'enfants', 'abandon de famille'],
  },
];

/** Fast lookup by id, used by deep links and the notification scheduler. */
export const BY_ID = Object.fromEntries(ARTICLES.map((a) => [a.id, a]));

export const CAT_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
