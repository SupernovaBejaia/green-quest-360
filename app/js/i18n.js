const STR = {
  fr: {
    appName: 'Green Quest 360',
    tagline: 'Photos 360 pour le nettoyage et le patrimoine',
    welcome: 'Bienvenue !',
    welcomeText: 'Indiquez votre nom et votre équipe. Ils seront joints à vos photos.',
    name: 'Votre nom', team: 'Votre équipe', continue: 'Continuer',
    online: 'En ligne', offline: 'Hors ligne',
    newPhoto: 'Nouvelle photo 360',
    myPhotos: 'Mes photos 360',
    none: 'Aucune photo pour le moment.',
    sendAll: 'Envoyer tout ({n})',
    sendingN: 'Envoi en cours…',
    st_local: 'Sur le téléphone', st_sending: 'Envoi… {p} %', st_sent: 'Envoyée ✓', st_error: 'Échec — réessayer',
    st_noconfig: 'Envoi non configuré',
    chooseType: 'Que photographiez-vous ?',
    waste_before: 'Déchets — avant nettoyage', waste_after: 'Déchets — après nettoyage', heritage: 'Lieu historique', other: 'Autre',
    place: 'Nom du lieu (facultatif)', placeHint: 'ex. Plage des Sablettes, Casbah…',
    howTo: 'Comment faire',
    tip1: 'Tenez le téléphone droit, devant vous.',
    tip2: 'Tournez sur place en gardant le téléphone au même endroit : ce sont vos pieds qui tournent autour du téléphone.',
    tip3: 'Visez chaque point blanc et restez immobile : la photo se prend toute seule.',
    tip4: 'Évitez les personnes qui bougent tout près de vous.',
    start: 'Commencer la prise de vue',
    permDenied: "Accès refusé. Autorisez la caméra et les capteurs de mouvement dans les réglages du navigateur, puis réessayez.",
    noCamera: "Impossible d'ouvrir la caméra.",
    noMotion: "Ce téléphone ne fournit pas l'orientation (gyroscope). La photo 360 n'est pas possible sur cet appareil.",
    holdPortrait: 'Tenez le téléphone à la verticale',
    aim: 'Visez le point', hold: 'Ne bougez plus…', captured: 'Photo prise',
    moveSlow: 'Plus lentement',
    lookUp: 'Visez vers le haut', lookDown: 'Visez vers le bas',
    nadirHint: 'Dernière photo (facultative) : visez vos pieds.',
    cancel: 'Annuler', finish: 'Terminer', finishNow: 'Terminer sans le sol',
    confirmCancel: 'Abandonner cette photo 360 ?',
    stitching: 'Assemblage de la photo 360…',
    st_features: 'Analyse des photos', st_match: 'Alignement des photos', st_optimize: 'Calcul des positions', st_render: 'Création de la photo 360', st_prepare: 'Préparation',
    keepOpen: "Gardez l'application ouverte, cela prend environ une minute.",
    result: 'Votre photo 360',
    partial: "L'alignement automatique a été partiel : quelques raccords peuvent être visibles. Vous pouvez recommencer si le résultat ne convient pas.",
    note: 'Remarque (facultatif)', notePh: 'Quantité de déchets, état du site…',
    save: 'Enregistrer', redo: 'Recommencer',
    saved: 'Enregistrée sur le téléphone. Elle sera envoyée dès que vous aurez Internet.',
    location: 'Position', noLocation: 'Position GPS non disponible',
    send: 'Envoyer', delete: 'Supprimer', download: 'Télécharger', back: 'Retour',
    confirmDelete: 'Supprimer définitivement cette photo du téléphone ?',
    settings: 'Réglages', sendSources: 'Envoyer aussi les photos sources (version HD sur ordinateur, plus de données)',
    storage: 'Espace utilisé : {u}', testConn: "Tester l'envoi", connOk: 'Connexion au Drive OK ✓', connFail: 'Échec de la connexion au Drive',
    language: 'Langue', about: 'Fonctionne sans Internet. Les photos restent sur le téléphone jusqu’à leur envoi.',
    install: "Installer l'application", installIos: "Pour l'installer : bouton Partager puis « Sur l'écran d'accueil ».",
    lowStorage: 'Espace de stockage faible sur le téléphone.',
    error: 'Erreur', retry: 'Réessayer',
    shots: 'photos',
  },
  ar: {
    appName: 'Green Quest 360',
    tagline: 'صور 360 للتنظيف والتراث',
    welcome: 'مرحبا!',
    welcomeText: 'أدخل اسمك وفريقك. سيُرفقان بصورك.',
    name: 'اسمك', team: 'فريقك', continue: 'متابعة',
    online: 'متصل', offline: 'غير متصل',
    newPhoto: 'صورة 360 جديدة',
    myPhotos: 'صوري 360',
    none: 'لا توجد صور بعد.',
    sendAll: 'إرسال الكل ({n})',
    sendingN: 'جارٍ الإرسال…',
    st_local: 'على الهاتف', st_sending: 'إرسال… {p}٪', st_sent: 'أُرسلت ✓', st_error: 'فشل — أعد المحاولة',
    st_noconfig: 'الإرسال غير مُعدّ',
    chooseType: 'ماذا تصوّر؟',
    waste_before: 'النفايات — قبل التنظيف', waste_after: 'النفايات — بعد التنظيف', heritage: 'موقع تاريخي', other: 'أخرى',
    place: 'اسم المكان (اختياري)', placeHint: 'مثال: شاطئ، القصبة…',
    howTo: 'طريقة التصوير',
    tip1: 'أمسك الهاتف مستقيمًا أمامك.',
    tip2: 'استدر في مكانك مع إبقاء الهاتف في نفس الموضع: قدماك هما اللتان تدوران حول الهاتف.',
    tip3: 'صوّب نحو كل نقطة بيضاء وابقَ ثابتًا: تُلتقط الصورة تلقائيًا.',
    tip4: 'تجنّب الأشخاص المتحركين بالقرب منك.',
    start: 'بدء التصوير',
    permDenied: 'تم رفض الإذن. اسمح بالكاميرا ومستشعرات الحركة في إعدادات المتصفح ثم أعد المحاولة.',
    noCamera: 'تعذّر فتح الكاميرا.',
    noMotion: 'هذا الهاتف لا يوفّر مستشعر الاتجاه (الجيروسكوب). لا يمكن التقاط صورة 360 على هذا الجهاز.',
    holdPortrait: 'أمسك الهاتف بشكل عمودي',
    aim: 'صوّب نحو النقطة', hold: 'لا تتحرك…', captured: 'تم التقاط الصورة',
    moveSlow: 'ببطء أكثر',
    lookUp: 'صوّب إلى الأعلى', lookDown: 'صوّب إلى الأسفل',
    nadirHint: 'الصورة الأخيرة (اختيارية): صوّب نحو قدميك.',
    cancel: 'إلغاء', finish: 'إنهاء', finishNow: 'إنهاء بدون الأرض',
    confirmCancel: 'التخلي عن صورة 360 هذه؟',
    stitching: 'جارٍ تجميع صورة 360…',
    st_features: 'تحليل الصور', st_match: 'محاذاة الصور', st_optimize: 'حساب المواضع', st_render: 'إنشاء صورة 360', st_prepare: 'التحضير',
    keepOpen: 'أبقِ التطبيق مفتوحًا، يستغرق ذلك حوالي دقيقة.',
    result: 'صورتك 360',
    partial: 'كانت المحاذاة التلقائية جزئية: قد تظهر بعض الوصلات. يمكنك إعادة التصوير إذا لم تكن النتيجة مناسبة.',
    note: 'ملاحظة (اختياري)', notePh: 'كمية النفايات، حالة الموقع…',
    save: 'حفظ', redo: 'إعادة',
    saved: 'حُفظت على الهاتف. ستُرسل عند توفر الإنترنت.',
    location: 'الموقع', noLocation: 'موقع GPS غير متوفر',
    send: 'إرسال', delete: 'حذف', download: 'تنزيل', back: 'رجوع',
    confirmDelete: 'حذف هذه الصورة نهائيًا من الهاتف؟',
    settings: 'الإعدادات', sendSources: 'إرسال الصور الأصلية أيضًا (نسخة عالية الدقة على الحاسوب، بيانات أكثر)',
    storage: 'المساحة المستخدمة: {u}', testConn: 'اختبار الإرسال', connOk: 'الاتصال بـ Drive يعمل ✓', connFail: 'فشل الاتصال بـ Drive',
    language: 'اللغة', about: 'يعمل بدون إنترنت. تبقى الصور على الهاتف حتى إرسالها.',
    install: 'تثبيت التطبيق', installIos: 'للتثبيت: زر المشاركة ثم «إضافة إلى الشاشة الرئيسية».',
    lowStorage: 'مساحة التخزين على الهاتف منخفضة.',
    error: 'خطأ', retry: 'أعد المحاولة',
    shots: 'صور',
  },
};

let lang = (() => {
  try { const s = localStorage.getItem('gq_lang'); if (s && STR[s]) return s; } catch {}
  return (navigator.language || 'fr').startsWith('ar') ? 'ar' : 'fr';
})();

export function t(key, vars) {
  let s = (STR[lang] && STR[lang][key]) ?? STR.fr[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}

export function getLang() { return lang; }

export function setLang(l) {
  lang = STR[l] ? l : 'fr';
  try { localStorage.setItem('gq_lang', lang); } catch {}
  applyDir();
}

export function applyDir() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}
