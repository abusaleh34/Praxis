import { analogyBank, readingBank } from './verbal-bank';
import { createHash } from 'node:crypto';
import type { Diagram } from './types';
import { lessonById } from './mentor-catalog';
export type MentorProblem = {
  prompt: string;
  choices: string[];
  answer: number;
  steps: string[];
  hint: string;
  diagram?: Diagram;
  unit: string;
  passage?: string;
};
export function makeProblem(
  lesson: string,
  seed: number,
  variant: number,
  contentSet = 0,
): MentorProblem {
  const meta = lessonById.get(lesson);
  if (!meta) throw new Error('Unknown lesson');
  const n = Math.abs(seed) % 7,
    v = ((variant % 3) + 3) % 3;
  let prompt = '',
    answer: number | string = 0,
    unit = '',
    hint = '',
    steps: string[] = [],
    diagram: Diagram | undefined,
    passage: string | undefined,
    wrong: (number | string)[] = [];
  if (lesson === 'triangle') {
    const a = 30 + n * 5,
      b = 40 + n * 3,
      c = 180 - a - b;
    diagram = { type: 'triangle', a, b };
    unit = '°';
    if (v === 0) {
      prompt = `في مثلث زاويتاه ${a}° و${b}°، أوجد الثالثة.`;
      answer = c;
      steps = [`${a} + ${b} = ${a + b}°`, `مجموع زوايا المثلث 180°.`, `س = 180 − ${a + b} = ${c}°`];
    } else if (v === 1) {
      const apex = 40 + n * 10;
      diagram = { type: 'isosceles', apex };
      prompt = `زاوية الرأس في مثلث متساوي الساقين ${apex}°. أوجد إحدى زاويتي القاعدة.`;
      answer = (180 - apex) / 2;
      steps = [
        `زاويتا القاعدة متساويتان.`,
        `مجموعهما 180 − ${apex} = ${180 - apex}°`,
        `الزاوية الواحدة = ${answer}°`,
      ];
    } else {
      diagram = { type: 'exterior', a, b: c, c: b };
      prompt = `زاويتان داخليتان بعيدتان عن زاوية خارجية قياسهما ${a}° و${b}°. أوجد الخارجية.`;
      answer = a + b;
      steps = [
        'الخارجية تساوي مجموع الزاويتين البعيدتين.',
        `${a} + ${b} = ${answer}°`,
        'يمكن التحقق بجمع الخارجية مع الداخلية المجاورة إلى 180°.',
      ];
    }
    hint = 'هل المطلوب زاوية داخلية أم خارجية؟ وما المجموع الذي تنتمي إليه؟';
  } else if (lesson === 'isosceles') {
    const apex = 40 + n * 10,
      base = (180 - apex) / 2;
    unit = '°';
    prompt =
      v === 1
        ? `زاوية قاعدة مثلث متساوي الساقين ${base}°. أوجد زاوية الرأس.`
        : v === 2
          ? `زاوية رأس مثلث متساوي الساقين ${apex}°. ما مجموع زاويتي القاعدة؟`
          : `زاوية الرأس ${apex}°. أوجد زاوية قاعدة المثلث متساوي الساقين.`;
    answer = v === 1 ? apex : v === 2 ? 180 - apex : base;
    diagram = v === 1 ? undefined : { type: 'isosceles', apex };
    hint = 'زاويتا القاعدة متساويتان. هل المطلوب إحداهما أم مجموعهما؟';
    steps = [
      `زاويتا القاعدة متساويتان.`,
      `الرأس + ضعفا زاوية القاعدة = 180°.`,
      `النتيجة المطلوبة = ${answer}°`,
    ];
  } else if (lesson === 'parallel') {
    const a = 40 + n * 10;
    unit = '°';
    answer = v === 1 ? 180 - a : a;
    prompt =
      v === 1
        ? `زاوية قياسها ${a}°؛ ما قياس الزاوية المجاورة لها على خط مستقيم؟`
        : `قاطع لمستقيمين متوازيين؛ زاوية قياسها ${a}°. أوجد الزاوية ${v === 0 ? 'المتناظرة معها' : 'المتبادلة داخليًا معها'}.`;
    diagram = v === 0 ? { type: 'parallel', a } : undefined;
    hint = 'المتناظرتان والمتبادلتان متساويتان عند التوازي؛ المتجاورتان على مستقيم متكاملتان.';
    steps = [
      meta.idea,
      `نستخدم ${v === 1 ? '180 ناقص المعطى' : 'تساوي القياسين'}.`,
      `النتيجة = ${answer}°`,
    ];
  } else if (lesson === 'exterior') {
    const a = 35 + n * 5,
      b = 45 + n * 3;
    unit = '°';
    answer = v === 1 ? b : v === 2 ? 180 - a - b : a + b;
    prompt =
      v === 1
        ? `خارجية مثلث ${a + b}°، وإحدى الداخليتين البعيدتين ${a}°. أوجد الداخلية البعيدة الأخرى.`
        : v === 2
          ? `زاوية خارجية لمثلث ${a + b}°. أوجد الزاوية الداخلية المجاورة.`
          : `الداخليتان البعيدتان ${a}° و${b}°. أوجد الزاوية الخارجية.`;
    diagram = v === 0 ? { type: 'exterior', a, b: 180 - a - b, c: b } : undefined;
    hint = 'هل تحتاج مجموع الداخليتين البعيدتين أم المكمل إلى 180؟';
    steps = [
      meta.idea,
      `الخارجية ${a + b}° والداخلية المجاورة ${180 - a - b}°.`,
      `المطلوب = ${answer}°`,
    ];
  } else if (lesson === 'rectangle') {
    const l = 8 + n,
      w = 3 + (n % 3);
    answer = v === 1 ? 2 * (l + w) : v === 2 ? w : l * w;
    unit = v === 0 ? 'سم²' : 'سم';
    prompt =
      v === 2
        ? `مساحة مستطيل ${l * w} سم² وطوله ${l} سم. أوجد العرض.`
        : `مستطيل طوله ${l} سم وعرضه ${w} سم. أوجد ${v === 1 ? 'المحيط' : 'المساحة'}.`;
    diagram = v === 2 ? undefined : { type: 'rectangle', length: l, width: w };
    hint = 'ميّز بين طول الحدود وتغطية الداخل. الوحدة تساعدك.';
    steps = [
      `المساحة = ${l} × ${w} = ${l * w} سم²`,
      `المحيط = 2 × (${l} + ${w}) = ${2 * (l + w)} سم`,
      `المطلوب = ${answer} ${unit}`,
    ];
    wrong = [v === 0 ? 2 * (l + w) : l * w, l + w, (l * w) / 2];
  } else if (lesson === 'right') {
    const k = 1 + (n % 4),
      a = 3 * k,
      b = 4 * k,
      c = 5 * k;
    answer = v === 1 ? b : v === 2 ? c * c : c;
    unit = v === 2 ? 'سم²' : 'سم';
    prompt =
      v === 1
        ? `وتر مثلث قائم ${c} سم وأحد ضلعَيه القائمين ${a} سم. أوجد الضلع الآخر.`
        : v === 2
          ? `ضلعان قائمان ${a} سم و${b} سم. ما مساحة المربع المبني على الوتر؟`
          : `ضلعان قائمان ${a} سم و${b} سم. أوجد الوتر.`;
    diagram = v === 0 ? { type: 'right', a, b, c } : undefined;
    hint = 'هل المطلوب طول أم مربع طول؟ حدد الوتر أولًا.';
    steps = [
      `الوتر² = ${a}² + ${b}² = ${c * c}`,
      `الوتر = ${c} سم والضلع الآخر = ${b} سم.`,
      `المطلوب = ${answer} ${unit}`,
    ];
  } else if (lesson === 'circle') {
    const central = 60 + n * 10;
    unit = '°';
    answer = v === 1 ? central : central / 2;
    prompt =
      v === 1
        ? `زاوية محيطية ${central / 2}°؛ أوجد المركزية المقابلة للقوس نفسه.`
        : v === 2
          ? `زاوية محيطية ${central / 2}°. أوجد زاوية محيطية أخرى تقابل القوس نفسه ومن الجهة نفسها.`
          : `زاوية مركزية ${central}°. أوجد المحيطية المقابلة للقوس نفسه.`;
    diagram = v === 0 ? { type: 'circle', central } : undefined;
    hint = 'انظر إلى مكان رأس كل زاوية والقوس الذي تقابله.';
    steps = [
      'للقوس نفسه المركزية ضعف المحيطية.',
      'زاويتان محيطيتان من الجهة نفسها وتقابلان القوس نفسه متساويتان.',
      `المطلوب = ${answer}°`,
    ];
  } else if (lesson === 'polygon') {
    const sides = [3, 4, 5, 6, 8, 10, 12][n],
      external = 360 / sides;
    answer = v === 1 ? external : v === 2 ? sides : 180 - external;
    unit = v === 2 ? 'أضلاع' : '°';
    prompt =
      v === 2
        ? `زاوية خارجية لمضلع منتظم ${external}°. كم عدد أضلاعه؟`
        : `مضلع منتظم له ${sides} أضلاع. أوجد قياس الزاوية ${v === 1 ? 'الخارجية' : 'الداخلية'}.`;
    diagram = v === 2 ? undefined : { type: 'polygon', n: sides };
    hint = 'الزوايا الخارجية تكوّن دورة كاملة مجموعها 360°.';
    steps = [
      `الخارجية = 360 ÷ ${sides} = ${external}°`,
      `الداخلية = 180 − ${external} = ${180 - external}°`,
      `المطلوب = ${answer} ${unit}`,
    ];
  } else if (lesson === 'ratio') {
    const price = 3 + n,
      count = 3 + (n % 3),
      target = count + 2;
    answer = v === 1 ? target : price * target;
    unit = v === 1 ? 'دفاتر' : 'ريال';
    prompt =
      v === 1
        ? `${count} دفاتر تكلف ${count * price} ريالًا. كم دفترًا تشتري بـ${target * price} ريالًا بالسعر نفسه؟`
        : `ثمن ${count} دفاتر ${count * price} ريالًا. ما ثمن ${target} دفاتر بالسعر نفسه؟`;
    hint = 'احسب سعر دفتر واحد أولًا.';
    steps = [
      `سعر الوحدة = ${count * price} ÷ ${count} = ${price} ريال`,
      `ثمن ${target} دفاتر = ${target * price} ريال`,
      `المطلوب = ${answer} ${unit}`,
    ];
  } else if (lesson === 'fractions') {
    const amount = 80 + n * 20,
      pct = [10, 25, 50][v],
      part = (amount * pct) / 100;
    answer = v === 1 ? amount - part : v === 2 ? amount + part : part;
    unit = 'ريال';
    prompt =
      v === 1
        ? `سعر سلعة ${amount} ريالًا، خُفض بنسبة ${pct}%. أوجد السعر بعد الخصم.`
        : v === 2
          ? `قيمة ${amount} ريالًا زادت ${pct}%. أوجد القيمة الجديدة.`
          : `أوجد ${pct}% من ${amount} ريالًا.`;
    hint = 'حدد أولًا قيمة الجزء، ثم هل تحتاج طرحه أم إضافته؟';
    steps = [
      `${pct}% من ${amount} = ${part}`,
      'الخصم طرح والزيادة جمع.',
      `المطلوب = ${answer} ريال`,
    ];
  } else if (lesson === 'speed' || lesson === 'physics') {
    const rate = lesson === 'physics' ? 4 + n : 40 + n * 10,
      time = 2 + (n % 3);
    answer = v === 1 ? time : v === 2 ? rate : rate * time;
    unit =
      v === 1
        ? lesson === 'physics'
          ? 'ثانية'
          : 'ساعة'
        : v === 2
          ? lesson === 'physics'
            ? 'م/ث'
            : 'كم/س'
          : lesson === 'physics'
            ? 'متر'
            : 'كم';
    const distance = rate * time,
      ru = lesson === 'physics' ? 'م/ث' : 'كم/س',
      tu = lesson === 'physics' ? 'ثوانٍ' : 'ساعات',
      du = lesson === 'physics' ? 'متر' : 'كم';
    prompt =
      v === 1
        ? `قطع جسم ${distance} ${du} بسرعة ثابتة ${rate} ${ru}. أوجد الزمن.`
        : v === 2
          ? `قطع جسم ${distance} ${du} خلال ${time} ${tu}. أوجد السرعة المتوسطة.`
          : `تحرك جسم بسرعة ثابتة ${rate} ${ru} لمدة ${time} ${tu}. أوجد المسافة.`;
    hint = 'المسافة = السرعة × الزمن. راجع الوحدات قبل التعويض.';
    steps = [
      `المسافة ${distance} ${du}، السرعة ${rate} ${ru}، الزمن ${time} ${tu}.`,
      'نضرب لإيجاد المسافة، ونقسم لإيجاد السرعة أو الزمن.',
      `المطلوب = ${answer} ${unit}`,
    ];
  } else if (lesson === 'chemistry') {
    const molar = [18, 44, 40, 32, 28, 16, 20][n],
      moles = 2 + (n % 3);
    answer = v === 1 ? molar * moles : v === 2 ? molar : moles;
    unit = v === 1 ? 'غ' : v === 2 ? 'غ/مول' : 'مول';
    prompt =
      v === 1
        ? `مادة كتلتها المولية ${molar} غ/مول. أوجد كتلة ${moles} مول.`
        : v === 2
          ? `كتلة ${moles} مول من مادة ${molar * moles} غ. أوجد الكتلة المولية.`
          : `كتلة عينة ${molar * moles} غ وكتلتها المولية ${molar} غ/مول. أوجد عدد المولات.`;
    hint = 'الكتلة = عدد المولات × الكتلة المولية.';
    steps = [
      `الكتلة ${molar * moles} غ = ${moles} × ${molar}`,
      `الوحدة المطلوبة هي ${unit}.`,
      `النتيجة = ${answer} ${unit}`,
    ];
  } else if (lesson === 'analogy') {
    const bank = [
      {
        pair: 'قلم : كتابة',
        a: 'فرشاة : رسم',
        w: ['ورقة : قلم', 'كتاب : مكتبة', 'رسم : لون'],
        why: 'أداة تؤدي وظيفة؛ القلم للكتابة والفرشاة للرسم.',
      },
      {
        pair: 'جزء : كل',
        a: 'صفحة : كتاب',
        w: ['مطر : سحاب', 'طبيب : علاج', 'باب : مفتاح'],
        why: 'الصفحة جزء من الكتاب؛ نحافظ على اتجاه الجزء إلى الكل.',
      },
      {
        pair: 'عطش : ماء',
        a: 'جوع : طعام',
        w: ['طعام : مطبخ', 'ماء : نهر', 'شبع : جوع'],
        why: 'حاجة وما يسدها: الماء يروي العطش والطعام يسد الجوع.',
      },
    ][v];
    prompt = `اختر الزوج الذي يطابق علاقة «${bank.pair}».`;
    answer = bank.a;
    wrong = bank.w;
    hint = 'صِغ العلاقة في جملة، ثم جرّب الجملة بالاتجاه نفسه على الخيارات.';
    steps = [bank.why, 'تشابه الموضوع وحده لا يكفي.', 'نختبر العلاقة واتجاهها في كلا الزوجين.'];
  } else if (lesson === 'reading') {
    passage =
      'زرع طلاب نباتين من النوع نفسه في تربة متماثلة، وسقوهما بالكمية نفسها. وضعوا أحدهما قرب النافذة والآخر في خزانة مظلمة. بعد أسبوع كان النبات قرب النافذة أكثر نموًا. اقترح المعلم تكرار التجربة قبل تعميم النتيجة.';
    const bank = [
      {
        q: 'ما العامل الذي اختلف بين النباتين؟',
        a: 'التعرض للضوء',
        w: ['نوع النبات', 'كمية الماء', 'نوع التربة'],
        why: 'النص يثبت النوع والتربة والماء، ويغير موضع النبات بالنسبة للضوء.',
      },
      {
        q: 'لماذا اقترح المعلم تكرار التجربة؟',
        a: 'للتحقق قبل تعميم النتيجة',
        w: ['لتغيير نوع النبات حتمًا', 'لأن الماء لا يؤثر', 'لإثبات أن كل النباتات متساوية'],
        why: 'الاقتراح مرتبط بالتحقق من النتيجة قبل تعميمها.',
      },
      {
        q: 'أي استنتاج تدعمه هذه التجربة مباشرة؟',
        a: 'النبات قرب النافذة نما أكثر في هذه التجربة',
        w: [
          'كل النباتات تنمو دون ماء',
          'الضوء هو العامل الوحيد للنمو دائمًا',
          'التربة لا تؤثر في أي نبات',
        ],
        why: 'نلتزم بما لوحظ في التجربة ولا نعمم حكمًا مطلقًا.',
      },
    ][v];
    prompt = bank.q;
    answer = bank.a;
    wrong = bank.w;
    hint = 'أعد قراءة الجملة التي تدعم إجابتك، واحذر الكلمات المطلقة مثل دائمًا وكل.';
    steps = [
      bank.why,
      'نستند إلى النص، لا إلى افتراض إضافي.',
      'نستبعد ما لا يقدم النص دليلًا عليه.',
    ];
  }
  if (contentSet !== 0 && ['analogy', 'reading'].includes(lesson)) {
    const bank =
      lesson === 'analogy' ? analogyBank[contentSet]?.[v] : readingBank[contentSet]?.items[v];
    if (!bank) throw new Error('Unknown verbal content set');
    prompt = lesson === 'analogy' ? `اختر الزوج الذي يطابق علاقة «${bank.q}».` : bank.q;
    passage = lesson === 'reading' ? readingBank[contentSet].passage : undefined;
    answer = bank.a;
    wrong = bank.w;
    steps = [
      bank.why,
      lesson === 'analogy'
        ? 'اختبر العلاقة واتجاهها، لا تشابه الموضوع فقط.'
        : 'استند إلى النص وتجنب التعميم الذي لا يدعمه.',
    ];
  }
  if (typeof answer === 'number') {
    answer = Math.round(answer * 100) / 100;
    wrong = [
      ...wrong,
      Number(answer) + 5,
      Math.max(1, Number(answer) - 5),
      Number(answer) * 2,
      Number(answer) + 10,
      Number(answer) / 2,
    ].map((x) => (typeof x === 'number' ? Math.round(x * 100) / 100 : x));
  }
  const options = [
    String(answer),
    ...new Set(wrong.map(String).filter((x) => x !== String(answer))),
  ].slice(0, 4);
  if (options.length !== 4) throw new Error('Invalid options');
  const sorted = options
    .map((value, i) => ({
      value,
      key: createHash('sha256').update(`${lesson}:${seed}:${variant}:${i}`).digest('hex'),
    }))
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((x) => x.value);
  return {
    prompt,
    choices: sorted,
    answer: sorted.indexOf(String(answer)),
    steps,
    hint,
    diagram,
    unit,
    passage,
  };
}
