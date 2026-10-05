'use client';
import { useEffect, useRef, useState } from 'react';
import { api, post } from '../client';
import { labModel, normalizeNumber } from '@/lib/lab';
import { lessonById } from '@/lib/mentor-catalog';
const templates = [
  ['triangle', 'زاوية مثلث ثالثة من زاويتين'],
  ['isosceles', 'زاوية قاعدة من زاوية الرأس'],
  ['circle', 'زاوية محيطية من المركزية'],
  ['rectangle', 'مساحة مستطيل من الطول والعرض'],
  ['exterior', 'خارجية مثلث من الداخليتين البعيدتين'],
  ['right', 'وتر مثلث قائم من الضلعين'],
  ['polygon', 'داخلية مضلع منتظم من عدد أضلاعه'],
  ['ratio', 'الثمن من سعر الوحدة والعدد'],
  ['fractions', 'قيمة نسبة من كمية أصلية'],
  ['speed', 'المسافة من سرعة ثابتة وزمن'],
  ['physics', 'المسافة في الحركة المنتظمة'],
  ['chemistry', 'الكتلة من المولات والكتلة المولية'],
];
export function PhotoQuestion({
  onApply,
}: {
  onApply: (lesson: string, a: number, b: number) => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(''),
    [text, setText] = useState(''),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(''),
    [error, setError] = useState(''),
    [vision, setVision] = useState(false),
    [remote, setRemote] = useState(false),
    [lesson, setLesson] = useState(''),
    [a, setA] = useState(''),
    [b, setB] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [prepared, setPrepared] = useState(false);
  const worker = useRef<import('tesseract.js').Worker | null>(null),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    api<{ vision: boolean }>('mentor')
      .then((d) => setVision(d.vision))
      .catch(() => {});
    return () => {
      mounted.current = false;
      void worker.current?.terminate();
    };
  }, []);
  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  const m = lesson ? labModel(lesson, Number(a) || 1, Number(b) || 1) : null;
  async function read() {
    if (!file) return;
    setBusy(true);
    setError('');
    setConfirmed(false);
    try {
      if (remote) {
        const image = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = reject;
          r.readAsDataURL(file);
        });
        const result = await post<{ text: string }>('vision', { image, consent: true });
        setText(result.text);
        setProgress('راجع النص والقيم قبل متابعة الحل.');
      } else {
        const { createWorker, PSM } = await import('tesseract.js');
        const w = await createWorker(['ara', 'eng'], 1, {
          workerPath: '/ocr/worker.min.js',
          corePath: '/ocr',
          langPath: '/ocr',
          cachePath: 'praxis-ocr-ara-best-v1',
          workerBlobURL: false,
          logger: (message) => {
            if (mounted.current)
              setProgress(
                message.status === 'recognizing text'
                  ? `نقرأ الصورة… ${Math.round(message.progress * 100)}%`
                  : 'نجهّز قارئ الصور؛ التنزيل الأول قد يستغرق قليلًا…',
              );
          },
        });
        worker.current = w;
        await w.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
        const result = await w.recognize(file);
        if (mounted.current) {
          setText(result.data.text);
          setProgress(`اكتملت القراءة. راجع النص؛ الأرقام والرموز قد تحتاج تصحيحًا.`);
        }
        await w.terminate();
        worker.current = null;
      }
    } catch {
      setError('تعذرت القراءة. جرّب صورة واضحة للسؤال فقط، أو اكتب النص أدناه.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  function prepare() {
    setPrepared(true);
    setConfirmed(false);
    let id = '';
    if (/دائر|مركزي/.test(text)) id = 'circle';
    else if (/مستطيل/.test(text)) id = 'rectangle';
    else if (/مثلث/.test(text))
      id = /قائم/.test(text)
        ? 'right'
        : /الساقين/.test(text)
          ? 'isosceles'
          : /خارج/.test(text)
            ? 'exterior'
            : 'triangle';
    else if (/نسبة|%|٪/.test(text)) id = 'fractions';
    else if (/سرعة|كم\/س/.test(text)) id = 'speed';
    setLesson(id);
    const nums = text.match(/[\d٠-٩۰-۹]+(?:[.٫][\d٠-٩۰-۹]+)?/g) ?? [];
    setA(nums[0] ? String(normalizeNumber(nums[0])) : '');
    setB(nums[1] ? String(normalizeNumber(nums[1])) : '');
    setError('');
  }
  function apply() {
    if (!lesson || !m) return;
    const av = normalizeNumber(a),
      bv = normalizeNumber(b) || 0;
    const current = labModel(lesson, av, bv);
    const valid =
      Number.isFinite(av) &&
      (lesson !== 'polygon' || Number.isInteger(av)) &&
      av >= current.ranges[0][0] &&
      av <= current.ranges[0][1] &&
      (current.labels.length === 1 ||
        (b.trim() !== '' &&
          Number.isFinite(bv) &&
          bv >= current.ranges[1][0] &&
          bv <= current.ranges[1][1]));
    if (!valid) {
      setError('القيم خارج نطاق المختبر. راجع الحدود المكتوبة بجانب كل حقل.');
      return;
    }
    onApply(lesson, av, bv);
    setError('');
  }
  return (
    <details className="panel photo-question">
      <summary>📷 عندك سؤال بصورة أو نص؟</summary>
      <p>
        اختر صورة لسؤال تملك حق استخدامه. تُقرأ على جهازك افتراضيًا؛ لا تُحفظ الصورة في حسابك.
        القراءة أنسب للنص المطبوع الواضح، وقد تخطئ في الخط اليدوي والرموز.
      </p>
      <label>
        صورة السؤال
        <input
          type="file"
          disabled={busy}
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && f.size > 4 * 1024 * 1024) {
              setError('الحد الأقصى 4 ميغابايت.');
              return;
            }
            setFile(f ?? null);
            setText('');
            setConfirmed(false);
            setError('');
          }}
        />
      </label>
      {preview && <img src={preview} className="question-photo" alt="الصورة التي اخترتها للسؤال" />}
      {vision && (
        <label className="consent">
          <input
            type="checkbox"
            disabled={busy}
            checked={remote}
            onChange={(e) => setRemote(e.target.checked)}
          />
          أوافق على إرسال هذه الصورة إلى OpenAI لتحسين القراءة. قد تنطبق سياسة احتفاظ المزود.
        </label>
      )}
      <button className="button primary" disabled={!file || busy} onClick={read}>
        {busy ? 'جارٍ قراءة الصورة…' : remote ? 'اقرأ بالنموذج' : 'اقرأ الصورة على جهازي'}
      </button>
      <p role="status">{progress}</p>
      <label>
        النص المستخرج — يمكنك كتابته أو تصحيحه
        <textarea
          disabled={busy}
          value={text}
          maxLength={10000}
          rows={4}
          onChange={(e) => {
            setText(e.target.value);
            setConfirmed(false);
          }}
          placeholder="اكتب السؤال أو اقرأه من الصورة"
        />
      </label>
      <button className="button ghost" disabled={!text.trim() || busy} onClick={prepare}>
        راجع نوع السؤال والقيم
      </button>
      {prepared && (
        <div className="photo-confirm">
          <p>
            اختر المطلوب الصحيح ثم حدّد المعطيات. اقتراح الأرقام لا يثبت علاقتها بالرسم؛ تأكد منها
            قبل الحساب.
          </p>
          <label>
            قالب الحل
            <select
              value={lesson}
              onChange={(e) => {
                setLesson(e.target.value);
                setConfirmed(false);
              }}
            >
              <option value="">اختر نوعًا مدعومًا</option>
              {templates.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {m?.labels.map((label, i) => (
            <label key={label}>
              {label} ({m.ranges[i][0]}–{m.ranges[i][1]})
              <input
                inputMode="decimal"
                value={i === 0 ? a : b}
                onChange={(e) => {
                  (i === 0 ? setA : setB)(e.target.value);
                  setConfirmed(false);
                }}
              />
            </label>
          ))}
          <label className="consent">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            راجعت النص والمطلوب وأسماء القيم، وهذا القالب يطابق سؤالي.
          </label>
          <button disabled={!confirmed || !lesson} className="button primary" onClick={apply}>
            افتح الشرح بقيم سؤالي
          </button>
          {lesson && (
            <p className="muted">
              بعد الشرح، ستجد ثلاث مسائل في {lessonById.get(lesson)?.name} للتدريب.
            </p>
          )}
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="muted">
        الحل التفاعلي يدعم القوالب المعروضة. الأسئلة المركّبة والأسئلة اللفظية المصوّرة تحتاج حاليًا
        اختيار درس مناسب ومراجعة بشرية.
      </p>
    </details>
  );
}
