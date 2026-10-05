'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Brand, Icon } from './icon';
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const links = [
    ['/learn', 'home', 'مساحتي'],
    ['/mentor', 'spark', 'المدرّب'],
    ['/library', 'book', 'المهارات'],
    ['/progress', 'chart', 'تقدّمي'],
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand-link">
          <Brand />
        </Link>
        <div className="nav-label">مساحتك للتعلّم</div>
        <nav aria-label="القائمة الرئيسية">
          {links.map(([href, icon, label]) => (
            <Link key={href} href={href} className={path === href ? 'nav-item active' : 'nav-item'}>
              <Icon name={icon} />
              {label}
              {path === href && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <Icon name="spark" />
          <strong>الفهم خطوة بخطوة.</strong>
          <p>كل محاولة فرصة تشوف فيها الفكرة من زاوية جديدة.</p>
          <div className="tiny-triangle">△</div>
        </div>
        <div className="side-bottom">
          <Link href="/privacy">
            <Icon name="shield" size={17} /> الخصوصية
          </Link>
          <span>Praxis · النسخة التجريبية</span>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <div className="mobile-brand">
            <Brand />
          </div>
          <div className="crumb">
            مساحة التعلّم <span>/</span>{' '}
            {path === '/mentor'
              ? 'المدرّب التفاعلي'
              : path === '/challenge'
                ? 'تدريب الوقت'
                : path === '/report'
                  ? 'التقرير الأسبوعي'
                  : path === '/library'
                    ? 'الهندسة'
                    : path === '/progress'
                      ? 'تقدّمك'
                      : path.startsWith('/session')
                        ? 'جلسة تعلّم'
                        : 'بداية جديدة'}
          </div>
          <span className="top-pill">
            <span /> القدرات والتحصيلي
          </span>
        </header>
        <main>{children}</main>
        <footer className="app-footer">
          <span>تعلّم على مهل. وتقدّم بثقة.</span>
          <Link href="/privacy">بياناتك وخصوصيتك</Link>
        </footer>
      </div>
      <nav className="bottom-nav" aria-label="التنقل على الجوال">
        {links.map(([href, icon, label]) => (
          <Link href={href} key={href} className={path === href ? 'active' : ''}>
            <Icon name={icon} size={21} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
