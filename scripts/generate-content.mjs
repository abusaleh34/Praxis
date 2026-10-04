import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const families = [
  ['triangle', 'زوايا المثلث', 'مجموع زوايا المثلث'],
  ['isosceles', 'المثلث متساوي الساقين', 'تساوي زاويتي القاعدة'],
  ['parallel', 'المستقيمات المتوازية', 'الزوايا المتناظرة'],
  ['exterior', 'الزاوية الخارجية', 'زاوية خارج المثلث'],
  ['rectangle', 'مساحة المستطيل', 'التمييز بين المساحة والمحيط'],
  ['right', 'المثلث القائم', 'نظرية فيثاغورس'],
  ['circle', 'زوايا الدائرة', 'الزاوية المركزية والمحيطية'],
  ['polygon', 'المضلعات المنتظمة', 'قياس الزاوية الداخلية'],
];
const triples = [
  [3, 4, 5],
  [6, 8, 10],
  [5, 12, 13],
  [8, 15, 17],
  [9, 12, 15],
  [12, 16, 20],
  [7, 24, 25],
  [10, 24, 26],
  [15, 20, 25],
  [16, 30, 34],
  [20, 21, 29],
];
const polygons = [3, 4, 5, 6, 8, 9, 10, 12, 15, 18, 20];
const questions = [];
function make(kind, v, split, index) {
  const [type, skill, title] = families[kind];
  let answer,
    prompt,
    diagram,
    steps,
    hints,
    wrong,
    unit = '°';
  const h = (text, highlight) => ({ text, highlight });
  if (type === 'triangle') {
    const a = 30 + v * 3,
      b = 45 + v * 2;
    answer = 180 - a - b;
    prompt = `في المثلث المرسوم، قياس زاويتين ${a}° و${b}°. ما قياس الزاوية س؟`;
    diagram = { type, a, b };
    steps = [
      `مجموع زوايا أي مثلث يساوي 180°.`,
      `مجموع الزاويتين المعلومتين: ${a} + ${b} = ${a + b}°.`,
      `إذن س = 180 − ${a + b} = ${answer}°.`,
    ];
    hints = [
      h('ما مجموع الزوايا الداخلية في المثلث؟', 'all'),
      h(`اجمع الزاويتين المعلومتين: ${a}° و${b}°.`, 'known'),
      h(`المتبقي من 180° بعد طرح ${a + b}° هو الزاوية س.`, 'target'),
    ];
    wrong = [
      [a + b, 'هذا مجموع الزاويتين المعلومتين، وليس الزاوية المتبقية.'],
      [360 - a - b, '360° تخص دورة كاملة؛ المثلث مجموع زواياه 180°.'],
      [180 - a, 'لقد طرحت زاوية واحدة فقط.'],
    ];
  } else if (type === 'isosceles') {
    const apex = 30 + v * 10;
    answer = (180 - apex) / 2;
    prompt = `مثلث متساوي الساقين، زاوية رأسه ${apex}°. ما قياس زاوية القاعدة س؟`;
    diagram = { type, apex };
    steps = [
      `زاويتا القاعدة متساويتان لأن الساقين متساويتان.`,
      `المتبقي لزاويتي القاعدة: 180 − ${apex} = ${180 - apex}°.`,
      `س = ${180 - apex} ÷ 2 = ${answer}°.`,
    ];
    hints = [
      h('علامتا التطابق تعنيان أن الساقين متساويتان. ماذا تعرف عن زاويتي القاعدة؟', 'sides'),
      h(`اطرح زاوية الرأس ${apex}° من مجموع زوايا المثلث.`, 'known'),
      h('قسّم الزاوية المتبقية بالتساوي بين زاويتي القاعدة.', 'target'),
    ];
    wrong = [
      [180 - apex, 'هذه قيمة زاويتي القاعدة معًا؛ المطلوب زاوية واحدة.'],
      [apex / 2, 'نصف زاوية الرأس لا يعطي زاوية القاعدة.'],
      [apex, 'تساوي الساقين لا يعني أن زاوية الرأس تساوي القاعدة.'],
    ];
  } else if (type === 'parallel') {
    const a = 35 + v * 10;
    answer = a;
    prompt = `يقطع مستقيم خطين متوازيين. الزاويتان المعلّمتان متناظرتان، وإحداهما ${a}°. ما قياس س؟`;
    diagram = { type, a };
    steps = [
      'الزاويتان في الموضع نفسه بالنسبة إلى القاطع والخطين المتوازيين.',
      'الزوايا المتناظرة بين مستقيمين متوازيين متساوية.',
      `إذن س = ${a}°.`,
    ];
    hints = [
      h('لاحظ علامتي التوازي على الخطين.', 'lines'),
      h('قارن موضع كل زاوية بالنسبة إلى القاطع: هل هما متناظرتان؟', 'known'),
      h('الزاويتان المتناظرتان بين خطين متوازيين لهما القياس نفسه.', 'target'),
    ];
    wrong = [
      [180 - a, 'هذه الزاوية المكملة؛ المطلوب زاوية متناظرة وليست مجاورة.'],
      [a / 2, 'التناظر لا يقتضي تنصيف الزاوية.'],
      [a + 90, 'لا توجد هنا علاقة تقتضي إضافة زاوية قائمة.'],
    ];
  } else if (type === 'exterior') {
    const a = 30 + v * 3,
      c = 40 + v * 2;
    answer = a + c;
    prompt = `امتد ضلع المثلث عند القاعدة، فصنع الزاوية الخارجية س. الزاويتان الداخليتان البعيدتان ${a}° و${c}°. أوجد س.`;
    diagram = { type, a, b: 180 - a - c, c };
    steps = [
      'الزاوية الخارجية تساوي مجموع الزاويتين الداخليتين غير المجاورتين لها.',
      `س = ${a} + ${c}.`,
      `إذن س = ${answer}°.`,
    ];
    hints = [
      h('ميّز الزاوية الخارجية عن الزاوية الداخلية المجاورة لها.', 'target'),
      h('الزاوية الخارجية تساوي مجموع الزاويتين الداخليتين البعيدتين.', 'known'),
      h(`اجمع ${a}° و${c}° فقط.`, 'all'),
    ];
    wrong = [
      [180 - a - c, 'هذه الزاوية الداخلية المجاورة، وليست الخارجية.'],
      [180 - a, 'لا يكفي استخدام زاوية داخلية واحدة فقط.'],
      [Math.abs(a - c), 'العلاقة هنا مجموع الزاويتين، وليست الفرق بينهما.'],
    ];
  } else if (type === 'rectangle') {
    const length = 6 + v,
      width = 3 + (v % 5);
    answer = length * width;
    unit = 'سم²';
    prompt = `مستطيل طوله ${length} سم وعرضه ${width} سم. ما مساحته؟`;
    diagram = { type, length, width };
    steps = [
      'مساحة المستطيل = الطول × العرض.',
      `المساحة = ${length} × ${width}.`,
      `إذن المساحة = ${answer} سم².`,
    ];
    hints = [
      h('المساحة تقيس السطح الداخلي، لا طول الحدود.', 'area'),
      h('نحتاج إلى الطول والعرض معًا.', 'sides'),
      h(`اضرب ${length} في ${width}، واستخدم السنتيمتر المربع.`, 'area'),
    ];
    wrong = [
      [2 * (length + width), 'هذه صيغة المحيط؛ المطلوب مساحة السطح.'],
      [length + width, 'جمع الطول والعرض لا يعطي المساحة.'],
      [(length * width) / 2, 'تنصيف حاصل الضرب يستخدم لمساحة المثلث، وليس المستطيل.'],
    ];
  } else if (type === 'right') {
    const [a, b, c] = triples[v];
    answer = c;
    unit = 'سم';
    prompt = `مثلث قائم الزاوية، طول ضلعَيه القائمَين ${a} سم و${b} سم. ما طول الوتر س؟`;
    diagram = { type, a, b, c };
    steps = [
      'في المثلث القائم: مربع الوتر = مجموع مربعي الضلعين القائمين.',
      `س² = ${a}² + ${b}² = ${a * a} + ${b * b} = ${c * c}.`,
      `نأخذ الجذر الموجب: س = ${c} سم.`,
    ];
    hints = [
      h('الوتر هو الضلع المقابل لعلامة الزاوية القائمة.', 'target'),
      h('استخدم فيثاغورس: مربع الوتر يساوي مجموع مربعي الضلعين.', 'sides'),
      h(`احسب الجذر التربيعي لـ (${a * a} + ${b * b}).`, 'target'),
    ];
    wrong = [
      [a + b, 'نجمع مربعي الضلعين، لا طوليهما مباشرة.'],
      [c * c, 'وصلت إلى مربع الوتر؛ بقي أخذ الجذر التربيعي.'],
      [b - a, 'فرق الضلعين لا يحدد الوتر.'],
    ];
  } else if (type === 'circle') {
    const central = 50 + v * 10;
    answer = central / 2;
    prompt = `الزاوية المركزية المقابلة للقوس الملوّن ${central}°. ما قياس الزاوية المحيطية س المقابلة للقوس نفسه؟`;
    diagram = { type, central };
    steps = [
      'الزاوية المحيطية المقابلة لقوس تساوي نصف الزاوية المركزية المقابلة للقوس نفسه.',
      `س = ${central} ÷ 2.`,
      `إذن س = ${answer}°.`,
    ];
    hints = [
      h('الزاويتان تقابلان القوس الملوّن نفسه.', 'arc'),
      h('رأس الزاوية المركزية في المركز، ورأس المحيطية على الدائرة.', 'known'),
      h('الزاوية المحيطية تساوي نصف الزاوية المركزية.', 'target'),
    ];
    wrong = [
      [central, 'الزاوية المحيطية نصف المركزية، وليست مساوية لها.'],
      [central * 2, 'لقد ضاعفت الزاوية؛ المطلوب تنصيفها.'],
      [180 - central, 'علاقة التكامل ليست العلاقة المستخدمة هنا.'],
    ];
  } else {
    const n = polygons[v];
    answer = 180 - 360 / n;
    prompt = `مضلع منتظم له ${n} أضلاع. ما قياس كل زاوية داخلية فيه؟`;
    diagram = { type, n };
    steps = [
      `مجموع الزوايا الخارجية لأي مضلع محدب = 360°، وهي متساوية في المنتظم.`,
      `الزاوية الخارجية = 360 ÷ ${n} = ${360 / n}°.`,
      `الداخلية = 180 − ${360 / n} = ${answer}°.`,
    ];
    hints = [
      h('كل الأضلاع والزوايا متساوية في المضلع المنتظم.', 'all'),
      h(`ابدأ بالزاوية الخارجية: اقسم 360° على عدد الأضلاع ${n}.`, 'known'),
      h('الزاوية الداخلية والخارجية المجاورة مجموعهما 180°.', 'target'),
    ];
    wrong = [
      [360 / n, 'هذه الزاوية الخارجية؛ المطلوب الداخلية.'],
      [(n - 2) * 180, 'هذا مجموع الزوايا الداخلية؛ المطلوب زاوية واحدة.'],
      [180 / n, 'قسمة 180 على عدد الأضلاع ليست العلاقة المطلوبة.'],
    ];
  }
  const values = new Set([answer]);
  const alternatives = [];
  for (const [value, feedback] of wrong) {
    if (value > 0 && !values.has(value)) {
      values.add(value);
      alternatives.push({ value, feedback });
    }
  }
  for (let d = 5; alternatives.length < 3; d += 5) {
    const value = answer + d;
    if (!values.has(value)) {
      values.add(value);
      alternatives.push({
        value,
        feedback: 'راجع العلاقة الهندسية ثم طبّقها على الأرقام المعطاة.',
      });
    }
  }
  const answerIndex = index % 4;
  const choices = alternatives.slice(0, 3);
  choices.splice(answerIndex, 0, {
    value: answer,
    feedback: 'إجابة صحيحة. راجع خطوات الحل لتثبيت الفكرة.',
  });
  const id = `${split}-${String(index + 1).padStart(2, '0')}`;
  return {
    id,
    split,
    skillId: type,
    skill,
    title,
    prompt,
    unit,
    choices: choices.map((x) => x.value),
    answerIndex,
    feedback: choices.map((x) => x.feedback),
    steps,
    hints,
    diagram,
    difficulty: ['right', 'polygon', 'circle'].includes(type) ? 'متوسط' : 'أساسي',
    source: {
      kind: 'original',
      author: 'Praxis · مسودة بمساعدة الذكاء الاصطناعي',
      reference: `PRX-ORIGINAL-${id}`,
      reviewStatus: 'draft',
    },
    estimatedSeconds: type === 'right' ? 100 : 70,
  };
}
for (let i = 0; i < 50; i++) questions.push(make(i % 8, Math.floor(i / 8), 'practice', i));
for (let i = 0; i < 15; i++) questions.push(make(i % 8, 7 + Math.floor(i / 8), 'pre', i));
for (let i = 0; i < 15; i++) questions.push(make(i % 8, 9 + Math.floor(i / 8), 'post', i));
mkdirSync(`${root}/content`, { recursive: true });
writeFileSync(`${root}/content/questions.json`, JSON.stringify(questions, null, 2) + '\n');
const cases = questions
  .filter((q) => q.split === 'practice')
  .flatMap((q) =>
    q.choices.flatMap((value, index) =>
      index === q.answerIndex
        ? []
        : [
            {
              questionId: q.id,
              wrongChoice: index,
              wrongValue: value,
              expectedMisconception: q.feedback[index],
              status: 'needs-human-review',
            },
          ],
    ),
  );
writeFileSync(`${root}/content/evaluation-cases.json`, JSON.stringify(cases, null, 2) + '\n');
console.log(
  `Generated ${questions.length} original DRAFT questions and ${cases.length} evaluation cases. Human review remains required.`,
);
