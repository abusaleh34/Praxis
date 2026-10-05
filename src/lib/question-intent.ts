import { normalizeNumber } from './lab';

// Suggestions are deliberately conservative: the requested quantity matters more
// than the shape mentioned in the question. Unknown requests need clarification.
export function questionIntent(text: string) {
  const clean = text.replace(/[\u064B-\u065F\u0670]/g, '');
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
  // No implicit conversion between metres and centimetres or compound tasks.
  if (/متر|(?:^|\s)م(?:\s|[،.؟]|$)/.test(clean) && template.startsWith('rectangle')) {
    template = '';
    message = 'وحّد الطول والعرض إلى السنتيمتر أولًا، ثم اختر المساحة أو المحيط.';
  }
  const nums = clean.match(/[\d٠-٩۰-۹]+(?:[.٫][\d٠-٩۰-۹]+)?/g) ?? [];
  return { template, message, values: nums.slice(0, 2).map(normalizeNumber) };
}
