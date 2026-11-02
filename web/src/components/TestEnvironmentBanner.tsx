// AUD-024: the public test site (GitHub Pages, pointing at the staging) says so on every screen, so nobody types real
// data into it. Only builds made with VITE_AMBIENTE_TESTE=1 show it (site.yml); production never does.
const IS_TEST_SITE = import.meta.env.VITE_AMBIENTE_TESTE === '1';

export function TestEnvironmentBanner() {
  if (!IS_TEST_SITE) return null;
  return (
    <div
      role="note"
      className="sticky top-0 z-[70] px-4 py-1.5 bg-warning-100 text-center text-xs font-bold tracking-wide text-concrete-900"
    >
      AMBIENTE DE TESTE — não use dados reais
    </div>
  );
}
