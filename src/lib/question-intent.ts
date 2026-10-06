import { normalizeNumber } from './lab';

// Suggestions are deliberately conservative: the requested quantity matters more
// than the shape mentioned in the question. Unknown requests need clarification.
export function questionIntent(text: string) {
  const clean = text
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[٠-٩۰-۹]/g, (c) => String(normalizeNumber(c)))
    .replace(/٫/g, '.')
    // A leading question label is metadata, never a measurement.
    .replace(/^\s*(?:(?:السؤال|سؤال|س)\s*(?:رقم\s*)?\d+\s*[:).،-]?|\d+\s*[).:-](?!\d))\s*/, '');
  const request = clean.split(/(?:أوجد|اوجد|احسب|ما |كم |المطلوب)/).at(-1) ?? clean;
  let template = '';
  let message = 'حدد المطلوب من القوالب أدناه؛ لم أتعرف عليه بثقة.';
  if (/مستطيل/.test(clean)) {
    const area = /مساح/.test(request),
      perimeter = /محيط/.test(request);
    const sidesGiven = /طول/.test(clean) && /عرض/.test(clean);
    if (sidesGiven && area !== perimeter)
      template = perimeter ? 'rectangle-perimeter' : 'rectangle';
    message = template
      ? perimeter
        ? 'المطلوب طول الحدود: سنحسب المحيط بوحدة سم.'
        : 'المطلوب تغطية الداخل: سنحسب المساحة بوحدة سم².'
      : 'هل تريد المساحة أم المحيط؟ نحتاج الطول والعرض لهذا القالب.';
  } else if (/مثلث/.test(clean) && /الثالث/.test(request) && !/قائم|الساقين/.test(clean))
    template = 'triangle';
  else if (/محيطي/.test(request) && /مركزي/.test(clean)) template = 'circle';
  else if (/قاعد/.test(request) && /الساقين/.test(clean)) template = 'isosceles';
  else if (/وتر/.test(request) && /قائم/.test(clean)) template = 'right';
  else if (/خارج/.test(request) && /بعيد/.test(clean)) template = 'exterior';
  else if (/مساف/.test(request) && /سرع/.test(clean)) template = 'speed';
  const number = String.raw`(\d+(?:\.\d+)?)`;
  const labelled = (label: string) => [
    ...clean.matchAll(
      new RegExp(label + String.raw`\s*(?:يساوي|تساوي|هو|هي|=|:)?\s*` + number, 'g'),
    ),
  ];
  let values: number[] = [];
  if (template.startsWith('rectangle')) {
    const length = labelled('(?:طوله|الطول|طول المستطيل)'),
      width = labelled('(?:عرضه|العرض|عرض المستطيل)');
    if (length.length === 1 && width.length === 1)
      values = [Number(length[0][1]), Number(width[0][1])];
    // Unknown/mixed dimensions require an explicit conversion, not an assumed cm.
    if (/(?:^|\s)(?:متر|أمتار|امتار|م|ملم|مم|كم|قدم|بوصة)(?=\s|[،.؟]|$)/.test(clean)) {
      template = '';
      message = 'وحّد الطول والعرض إلى السنتيمتر أولًا، ثم اختر المساحة أو المحيط.';
      values = [];
    }
  } else if (template === 'speed') {
    // Read the speed together with its compound unit; never borrow its denominator
    // as the duration. The lab uses km/h and hours regardless of source units.
    const speed = [
      ...clean.matchAll(
        new RegExp(
          number +
            String.raw`\s*(كم|كيلومتر(?:ا|ات)?|متر(?:ا)?|م)\s*(?:/|في(?: ال)?|لكل\s*)\s*(ساعة|س|دقيقة|ثانية|ث)(?=\s|[،.؟]|$)`,
          'g',
        ),
      ),
    ];
    const duration = [
      ...clean.matchAll(
        new RegExp(
          number + String.raw`\s*(ساعات|ساعة|دقائق|دقيقة|ثواني|ثوان|ثانية)(?=\s|[،.؟]|$)`,
          'g',
        ),
      ),
    ];
    const remainder = clean.replace(speed[0]?.[0] ?? '', '').replace(duration[0]?.[0] ?? '', '');
    if (speed.length === 1 && duration.length === 1 && !/\d|ساع|دقيق|ثوان|ثانية/.test(remainder)) {
      const [, velocity, distanceUnit, timeUnit] = speed[0];
      const hours = (unit: string) =>
        /ساعة|ساعات|^س$/.test(unit) ? 1 : /دقيق/.test(unit) ? 1 / 60 : 1 / 3600;
      const km = /كم|كيلومتر/.test(distanceUnit) ? 1 : 0.001;
      values = [
        (Number(velocity) * km) / hours(timeUnit),
        Number(duration[0][1]) * hours(duration[0][2]),
      ];
      message = `بعد توحيد الوحدات: السرعة ${Number(values[0].toPrecision(10))} كم/ساعة، والزمن ${Number(values[1].toPrecision(10))} ساعة. راجع القيم قبل المتابعة.`;
    } else {
      template = '';
      message =
        'حدد سرعة واحدة مع وحدتها (مثل 60 كم/ساعة)، وزمنًا واحدًا مع وحدته (مثل 30 دقيقة). وحّد الأزمنة المركبة أولًا.';
    }
  } else if (template) {
    const nums = clean.match(/\d+(?:\.\d+)?/g) ?? [];
    const count = ['circle', 'isosceles', 'polygon'].includes(template) ? 1 : 2;
    if (nums.length === count) values = nums.map(Number);
  }
  if (template && !values.length) {
    template = '';
    message =
      'لم تتضح المعطيات المرتبطة بالمطلوب. حدد القالب ثم أدخل القيم بوحداته المعروضة؛ لن نفترض أن أول رقمين هما المعطيات.';
  }
  if (/[−-]\s*\d/.test(clean)) {
    template = '';
    values = [];
    message = 'تحتاج القيم السالبة إلى مراجعة؛ أدخل المعطيات الصحيحة في القالب المناسب.';
  }
  return { template, message, values };
}
