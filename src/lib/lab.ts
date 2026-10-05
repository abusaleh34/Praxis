import type { Diagram } from './types';
export const labDefaults: Record<string, [number, number]> = {
  triangle: [50, 60],
  isosceles: [60, 0],
  parallel: [70, 0],
  exterior: [45, 65],
  rectangle: [8, 5],
  right: [3, 4],
  circle: [120, 0],
  polygon: [6, 0],
  ratio: [4, 6],
  fractions: [25, 200],
  speed: [60, 2],
  physics: [5, 4],
  chemistry: [18, 2],
};
export function labModel(id: string, a: number, b: number, target: 'area' | 'perimeter' = 'area') {
  let diagram: Diagram | undefined,
    result = 0,
    formula = '',
    labels = ['القيمة الأولى', 'القيمة الثانية'],
    ranges = [
      [1, 100],
      [1, 100],
    ],
    unit = '',
    checkpoint = { question: '', answer: 0, hint: '' };
  switch (id) {
    case 'triangle':
      labels = ['الزاوية الأولى', 'الزاوية الثانية'];
      ranges = [
        [20, 120],
        [20, Math.max(20, 170 - a)],
      ];
      diagram = { type: 'triangle', a, b };
      result = 180 - a - b;
      unit = '°';
      formula = `180 − (${a} + ${b}) = ${result}°`;
      checkpoint = {
        question: `كم مجموع الزاويتين ${a}° و${b}°؟`,
        answer: a + b,
        hint: 'نجمع المعلومتين أولًا، ولا نطرح من 180 في هذه الخطوة.',
      };
      break;
    case 'isosceles':
      labels = ['زاوية الرأس'];
      ranges = [[20, 140]];
      result = (180 - a) / 2;
      unit = '°';
      diagram = { type: 'isosceles', apex: a };
      formula = `(180 − ${a}) ÷ 2 = ${result}°`;
      checkpoint = {
        question: 'كم مجموع زاويتي القاعدة معًا؟',
        answer: 180 - a,
        hint: 'اطرح الرأس من 180. نقسم على اثنين في الخطوة التالية.',
      };
      break;
    case 'parallel':
      labels = ['الزاوية المعلومة'];
      ranges = [[20, 140]];
      result = a;
      unit = '°';
      diagram = { type: 'parallel', a };
      formula = `المتناظرة = ${a}°`;
      checkpoint = {
        question: 'إذا كان الخطان متوازيين، كم قياس الزاوية المتناظرة؟',
        answer: a,
        hint: 'تساوي الموضع مع التوازي يعني تساوي الزاويتين.',
      };
      break;
    case 'exterior':
      labels = ['الداخلية البعيدة الأولى', 'الداخلية البعيدة الثانية'];
      ranges = [
        [20, 110],
        [20, Math.max(20, 170 - a)],
      ];
      result = a + b;
      unit = '°';
      diagram = { type: 'exterior', a, b: 180 - a - b, c: b };
      formula = `${a} + ${b} = ${result}°`;
      checkpoint = {
        question: 'كم الزاوية الداخلية المجاورة للخارجية؟',
        answer: 180 - a - b,
        hint: 'الداخلية المجاورة هي الزاوية الثالثة في المثلث.',
      };
      break;
    case 'rectangle':
      labels = ['الطول (سم)', 'العرض (سم)'];
      ranges = [
        [2, 15],
        [2, 12],
      ];
      result = a * b;
      unit = 'سم²';
      diagram = { type: 'rectangle', length: a, width: b };
      formula = `${a} × ${b} = ${result} سم²`;
      checkpoint = {
        question: 'كم مربعًا في صف واحد إذا كان طول الصف يساوي الطول؟',
        answer: a,
        hint: 'كل مربع وحدة واحدة؛ عدد المربعات في الصف يساوي الطول.',
      };
      if (target === 'perimeter') {
        result = 2 * (a + b);
        unit = 'سم';
        formula = `2 × (${a} + ${b}) = ${result} سم`;
        checkpoint = {
          question: 'كم مجموع طول ضلع طويل وضلع قصير؟',
          answer: a + b,
          hint: 'اجمع الطول والعرض أولًا. لكل منهما ضلع مقابل مساوٍ له.',
        };
      }
      break;
    case 'right':
      labels = ['الضلع القائم الأول', 'الضلع القائم الثاني'];
      ranges = [
        [2, 12],
        [2, 12],
      ];
      result = Math.sqrt(a * a + b * b);
      unit = 'سم';
      diagram = { type: 'right', a, b, c: result };
      formula = `√(${a}² + ${b}²) ≈ ${+result.toFixed(2)} سم`;
      checkpoint = {
        question: 'كم مربع الوتر؟',
        answer: a * a + b * b,
        hint: 'اجمع مربعي الضلعين، دون أخذ الجذر الآن.',
      };
      break;
    case 'circle':
      labels = ['الزاوية المركزية'];
      ranges = [[30, 160]];
      result = a / 2;
      unit = '°';
      diagram = { type: 'circle', central: a };
      formula = `${a} ÷ 2 = ${result}°`;
      checkpoint = {
        question: 'كم مرة تكبر المركزية المحيطية لنفس القوس؟',
        answer: 2,
        hint: 'المركزية ضعف المحيطية؛ نبحث عن عامل الضرب.',
      };
      break;
    case 'polygon':
      labels = ['عدد الأضلاع'];
      ranges = [[3, 12]];
      result = 180 - 360 / a;
      unit = '°';
      diagram = { type: 'polygon', n: a };
      formula = `180 − (360 ÷ ${a}) ≈ ${+result.toFixed(2)}°`;
      checkpoint = {
        question: 'ما مجموع الزوايا الخارجية لدورة واحدة؟',
        answer: 360,
        hint: 'دورة كاملة تعيدنا إلى الاتجاه نفسه.',
      };
      break;
    case 'ratio':
      labels = ['سعر الوحدة (ريال)', 'عدد الوحدات'];
      ranges = [
        [1, 20],
        [1, 12],
      ];
      result = a * b;
      unit = 'ريال';
      formula = `${a} × ${b} = ${result} ريال`;
      checkpoint = {
        question: `ما تكلفة وحدتين بسعر ${a} للوحدة؟`,
        answer: a * 2,
        hint: 'السعر ثابت؛ وحدتان تعني ضعف سعر الواحدة.',
      };
      break;
    case 'fractions':
      labels = ['النسبة المئوية', 'الكمية الأصلية'];
      ranges = [
        [1, 100],
        [20, 300],
      ];
      result = (a * b) / 100;
      formula = `${a}% × ${b} = ${+result.toFixed(2)}`;
      checkpoint = {
        question: `كم 10% من ${b}؟`,
        answer: b / 10,
        hint: 'نقسم الكمية الأصلية على عشرة.',
      };
      break;
    case 'speed':
    case 'physics':
      labels = [
        id === 'physics' ? 'السرعة (م/ث)' : 'السرعة (كم/س)',
        id === 'physics' ? 'الزمن (ثانية)' : 'الزمن (ساعة)',
      ];
      ranges = [
        [1, id === 'physics' ? 15 : 120],
        [1, 10],
      ];
      result = a * b;
      unit = id === 'physics' ? 'متر' : 'كم';
      formula = `${a} × ${b} = ${result} ${unit}`;
      checkpoint = {
        question: 'أي عملية تربط السرعة بالزمن لإيجاد المسافة؟ اكتب 1 للضرب، أو 2 للقسمة.',
        answer: 1,
        hint: 'فكّر: هل تزيد المسافة بزيادة الزمن مع ثبات السرعة؟',
      };
      break;
    case 'chemistry':
      labels = ['الكتلة المولية (غ/مول)', 'عدد المولات'];
      ranges = [
        [2, 60],
        [1, 10],
      ];
      result = a * b;
      unit = 'غ';
      formula = `${a} × ${b} = ${result} غ`;
      checkpoint = {
        question: 'ما كتلة مول واحد حسب المعطى؟',
        answer: a,
        hint: 'الكتلة المولية هي كتلة مول واحد.',
      };
      break;
  }
  return { diagram, result, formula, labels, ranges, unit, checkpoint };
}
export function normalizeNumber(value: string) {
  return Number(
    value
      .trim()
      .replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
      .replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
      .replace('٫', '.')
      .replace(',', '.'),
  );
}

// Input validity is separate from the small default range used by sliders.
export function validLabValues(id: string, a: number, b: number) {
  const positive = (n: number) => Number.isFinite(n) && n > 0 && n <= 1_000_000;
  if (!positive(a)) return false;
  if (['triangle', 'exterior'].includes(id)) return positive(b) && a + b < 180;
  if (['isosceles', 'parallel', 'circle'].includes(id)) return a < 180;
  if (id === 'polygon') return Number.isInteger(a) && a >= 3 && a <= 100;
  if (id === 'fractions') return a <= 100 && positive(b);
  return (
    ['rectangle', 'right', 'ratio', 'speed', 'physics', 'chemistry'].includes(id) && positive(b)
  );
}

export function labInputHelp(id: string) {
  if (['triangle', 'exterior'].includes(id)) return 'زاويتان موجبتان مجموعهما أقل من 180°';
  if (['isosceles', 'parallel', 'circle'].includes(id)) return 'زاوية أكبر من صفر وأقل من 180°';
  if (id === 'polygon') return 'عدد صحيح من 3 إلى 100';
  if (id === 'fractions') return 'النسبة أكبر من صفر وحتى 100، والكمية موجبة';
  return 'قيمة موجبة حتى 1,000,000؛ تقبل الكسور العشرية';
}
