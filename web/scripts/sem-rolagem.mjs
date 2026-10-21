// U41/U42: no sign-up screen scrolls. Walks the whole sign-up of the demo build — choosing the side, every step of the
// worker and the company (with the WhatsApp code the demo simulates), the password and agreements, the e-mail code
// and completing the profile — plus the states that make a screen taller (a CNPJ that already has an account, a wrong
// code, a weak password, the agreements left unticked, changing the e-mail on the code screen — U43 — with an address
// that already has an account and then the code sent to the new one), on a small Android with the browser bars (360×600),
// an iPhone in Safari (390×664) and a computer. Fails when any of them scrolls.
// Needs `npx vite preview --port 4173` with the demo build (the CI runs it for the accessibility check).
// The login is checked by the E2E on the staging build (e2e/fluxos/08-cadastro-google.spec.ts): the demo's login has
// the list of demo accounts, which only exists there.
import { chromium } from 'playwright';

const BASE = process.env.SEM_ROLAGEM_URL ?? 'http://localhost:4173';
const SIZES = [
  [360, 600],
  [390, 664],
  [1280, 800]
];
/** A CNPJ the demo already has an account for, and one that is free. */
const TAKEN_CNPJ = '11.222.333/0001-81';
const FREE_CNPJ = '11.444.777/0001-61';

const problems = [];
let checked = 0;
const browser = await chromium.launch();

async function walk(width, height, role) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', (e) => problems.push(`${width}×${height} erro na página: ${e.message}`));
  async function check(name) {
    await page.waitForTimeout(450);
    const over = await page.evaluate(() => {
      const main = document.querySelector('main');
      return main ? main.scrollHeight - main.clientHeight : document.documentElement.scrollHeight - innerHeight;
    });
    checked++;
    if (over > 1) problems.push(`${width}×${height} ${role} · ${name}: passa ${over} px da tela`);
  }
  const next = async () => {
    await page.getByRole('button', { name: /^(Continuar|Enviar código|Confirmar número|Criar minha conta)$/ }).click();
    await page.waitForTimeout(700);
  };
  const type = (value) => page.locator('main input').first().fill(value);

  await page.goto(BASE + '/escolha-perfil');
  await page.waitForTimeout(1200);
  await check('escolha do lado');
  if (role === 'recrutador') await page.getByText('Quero contratar').click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.waitForTimeout(600);

  const answers =
    role === 'trabalhador'
      ? [
          ['nome', 'Marcos Pereira da Silva'],
          ['CPF', '390.533.447-05']
        ]
      : [
          ['nome da empresa', 'Eventos Serra Gaúcha'],
          ['responsável', 'Ana Souza'],
          ['CNPJ', FREE_CNPJ]
        ];
  for (const [step, value] of answers) {
    await check(step);
    if (step === 'CNPJ') {
      await type(TAKEN_CNPJ);
      await next();
      await check('CNPJ que já tem conta');
    }
    await type(value);
    await next();
  }
  await check('e-mail');
  await type(`sem.rolagem.${role}.${width}.${Date.now()}@exemplo.com`);
  await next();
  await check('WhatsApp');
  await type('(54) 99173-0426');
  await next();
  await check('código do WhatsApp');
  await type('000000');
  await next();
  await check('código do WhatsApp errado');
  await type('123456');
  await next();
  await check('senha e aceites');
  await page.locator('main input[type=password]').fill('abc');
  await next();
  await check('senha fraca');
  await page.locator('main input[type=password]').fill('senhaboa123');
  await next();
  await check('aceites faltando');
  await page.getByText('Tenho 18 anos ou mais').click();
  await page.getByRole('checkbox', { name: /Li e aceito/ }).check({ force: true });
  await next();
  await page.waitForTimeout(1200);
  await check('confirmar e-mail');
  await page.getByRole('button', { name: 'Trocar e-mail' }).click();
  await page.waitForTimeout(400);
  await check('trocar e-mail');
  const send = () => page.getByRole('button', { name: 'Enviar código para esse e-mail' }).click();
  await type('trabalhador@bicos.demo');
  await send();
  await page.waitForTimeout(900);
  await check('trocar para um e-mail que já tem conta');
  await type(`sem.rolagem.novo.${role}.${width}.${Date.now()}@exemplo.com`);
  await send();
  await page.waitForTimeout(900);
  if (!new URL(page.url()).pathname.startsWith('/verificar-email'))
    problems.push(`${width}×${height} ${role} · trocar e-mail saiu da tela do código`);
  await check('código enviado para o novo e-mail');
  await type('123456');
  await page.waitForTimeout(2000);
  await check('completar perfil');
  await page.close();
}

for (const [width, height] of SIZES) for (const role of ['trabalhador', 'recrutador']) await walk(width, height, role);
await browser.close();

if (problems.length) {
  console.log(`✗ ${problems.length} tela(s) de cadastro rolam:\n` + problems.map((p) => '  ' + p).join('\n'));
  process.exit(1);
}
console.log(`✓ ${checked} telas de cadastro sem rolagem (360×600, 390×664 e computador).`);
