// L03 (lançamento): utilitários do E2E — variáveis, cliente de administração (só no processo do teste, nunca no
// navegador), contas de teste com documento válido, estado entre os fluxos, prints e limpeza.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`E2E: falta ${name} (veja e2e/LEIA.md).`);
  return v;
}

/**
 * Token aceito pela secret de teste do Turnstile (1x000…AA), a que o staging e o E2E local usam. R08: com o
 * captcha ligado, todo login feito pelo Node (fora do navegador) também precisa mandar um.
 */
export const CAPTCHA_TESTE = 'XXXX.DUMMY.TOKEN.XXXX';

export const ENV = {
  /** Supabase direto (Auth Admin, consultas de conferência). */
  supabaseUrl: process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:55321',
  /** O mesmo endereço que o app usa para as funções (no local, o proxy de e2e/local/servidor.mjs). */
  functionsUrl: process.env.E2E_FUNCTIONS_URL ?? process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:55400',
  anonKey: () => need('E2E_ANON_KEY'),
  serviceKey: () => need('E2E_SERVICE_ROLE_KEY'),
  /** Caixa com "+" (Gmail): cada conta de teste recebe e-mail de verdade sem rebater. */
  emailBase: process.env.E2E_EMAIL_BASE ?? 'nivotech.dev@gmail.com',
  /** Local: o Turnstile de verdade não carrega sem internet — usa um falso com o token de teste da Cloudflare. */
  fakeTurnstile: process.env.E2E_FAKE_TURNSTILE === '1',
  password: 'Bicos-e2e-2026',
  /** O app sob teste — o mesmo baseURL do playwright.config.ts. */
  appUrl: process.env.E2E_BASE_URL ?? 'http://localhost:4173'
};

const here = fileURLToPath(new URL('.', import.meta.url));
const STATE = here + 'resultados/estado.json';
const SHOTS = here + 'resultados/prints/';

// ---- estado entre os fluxos (cada arquivo de teste roda em ordem e lê o que o anterior gravou) ----

export interface Conta {
  id: string;
  email: string;
  documento: string;
  nome: string;
  /** U10: o WhatsApp é de uma conta só — cada conta de teste tem o seu. */
  whatsapp?: string;
}
export interface Estado {
  execucao: string;
  contas: Record<string, Conta>;
  vaga?: string;
  /** Todas as contas criadas, para a limpeza no fim. */
  criadas: { id: string; email: string }[];
  prints: { arquivo: string; legenda: string; fluxo: string }[];
}

export function estado(): Estado {
  if (existsSync(STATE)) return JSON.parse(readFileSync(STATE, 'utf8')) as Estado;
  const novo: Estado = { execucao: Date.now().toString(36), contas: {}, criadas: [], prints: [] };
  salvar(novo);
  return novo;
}
export function salvar(e: Estado): void {
  mkdirSync(here + 'resultados', { recursive: true });
  writeFileSync(STATE, JSON.stringify(e, null, 2));
}
export function atualizar(fn: (e: Estado) => void): Estado {
  const e = estado();
  fn(e);
  salvar(e);
  return e;
}

// ---- dados de teste ----

/** Nome com o código da execução no fim: nunca colide com o de outra execução no mesmo banco. */
export function nomeDeTeste(base: string): string {
  return `${base} ${estado().execucao.slice(-5).toUpperCase()}`;
}

export function emailDeTeste(tag: string): string {
  const [user, domain] = ENV.emailBase.split('@');
  return `${user}+e2e-${estado().execucao}-${tag}@${domain}`;
}

const digitos = (seed: string, n: number) => {
  // FNV-1a da semente inteira, depois um gerador linear: dígitos diferentes para cada execução e conta.
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const out: number[] = [];
  while (out.length < n) {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    out.push((h >>> 16) % 10);
  }
  return out;
};

/** Um CPF válido e diferente para cada semente (dígitos verificadores certos). */
export function cpfValido(seed: string): string {
  const d = digitos(seed + estado().execucao, 9);
  for (const len of [9, 10]) {
    const soma = d.slice(0, len).reduce((s, v, i) => s + v * (len + 1 - i), 0);
    const r = (soma * 10) % 11;
    d.push(r === 10 ? 0 : r);
  }
  return d.join('');
}

/** U10: um celular diferente para cada semente e execução (o WhatsApp é de uma conta só). */
export function whatsappDeTeste(seed: string): string {
  return '119' + digitos('zap-' + seed + estado().execucao, 8).join('');
}

/** Um CNPJ válido e diferente para cada semente. */
export function cnpjValido(seed: string): string {
  const d = [...digitos(seed + estado().execucao, 8), 0, 0, 0, 1];
  for (const pesos of [
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  ]) {
    const r = d.reduce((s, v, i) => s + v * pesos[i], 0) % 11;
    d.push(r < 2 ? 0 : 11 - r);
  }
  return d.join('');
}

// ---- Supabase ----

let adminClient: SupabaseClient | null = null;
/** Cliente com a chave service_role — só no Node do teste. */
export function admin(): SupabaseClient {
  adminClient ??= createClient(ENV.supabaseUrl, ENV.serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return adminClient;
}

/** Um cliente "como a pessoa", com a senha dela (para conferir o que ela vê pelas regras do banco). */
export async function comoConta(email: string, senha = ENV.password): Promise<SupabaseClient> {
  const c = createClient(ENV.supabaseUrl, ENV.anonKey(), { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({
    email,
    password: senha,
    options: { captchaToken: CAPTCHA_TESTE }
  });
  if (error) throw new Error(`login de ${email}: ${error.message}`);
  return c;
}

/** O link que confirma o e-mail (o mesmo efeito do link do e-mail), pela Admin API. */
export async function linkDeConfirmacao(email: string): Promise<string> {
  const { data, error } = await admin().auth.admin.generateLink({
    type: 'magiclink',
    email,
    // Sem redirectTo o link volta para o Site URL do projeto — no staging, o site de teste, não este app.
    options: { redirectTo: ENV.appUrl + '/' }
  });
  if (error || !data.properties?.action_link) throw new Error(`generateLink: ${error?.message}`);
  return data.properties.action_link;
}

/**
 * U12: "Usar minha localização atual" no teste — o navegador libera a localização e diz que está em São Paulo
 * (os CEPs das vagas de teste são de lá, então o mural do trabalhador abre com elas).
 */
export async function liberarLocalizacao(page: Page, lat = -23.5505, lon = -46.6333): Promise<void> {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: lat, longitude: lon });
}

/** U11: o código de 6 números que confirma o e-mail (o mesmo efeito do código do e-mail), pela Admin API. */
export async function codigoDeConfirmacao(email: string): Promise<string> {
  const { data, error } = await admin().auth.admin.generateLink({ type: 'magiclink', email });
  const codigo = data?.properties?.email_otp;
  if (error || !codigo) throw new Error(`generateLink (código): ${error?.message}`);
  return codigo;
}

export async function linkDeRecuperacao(email: string): Promise<string> {
  const { data, error } = await admin().auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: ENV.appUrl + '/' }
  });
  if (error || !data.properties?.action_link) throw new Error(`generateLink: ${error?.message}`);
  return data.properties.action_link;
}

export async function idDaConta(email: string): Promise<string> {
  for (let page = 1; page < 20; page++) {
    const { data } = await admin().auth.admin.listUsers({ page, perPage: 200 });
    const u = data.users.find((x) => x.email === email);
    if (u) return u.id;
    if (data.users.length < 200) break;
  }
  throw new Error(`conta ${email} não encontrada`);
}

/** Registra a conta para a limpeza do fim (mesmo se o teste falhar depois). */
export function criada(id: string, email: string): void {
  atualizar((e) => {
    if (!e.criadas.some((c) => c.id === id)) e.criadas.push({ id, email });
  });
}

// ---- navegador ----

/** Turnstile falso (só no E2E local): devolve o token de teste da Cloudflare. */
export async function prepararPagina(page: Page): Promise<void> {
  if (ENV.fakeTurnstile) {
    await page.route('https://challenges.cloudflare.com/turnstile/**', (route) =>
      route.fulfill({
        contentType: 'text/javascript',
        body: `window.turnstile = { _cb: {}, render(el, o) { const id = String(Math.random()); this._cb[id] = o; return id; },
          execute(id) { const o = this._cb[id]; setTimeout(() => o && o.callback('XXXX.DUMMY.TOKEN.XXXX'), 50); },
          reset() {}, remove() {} };`
      })
    );
  }
  // CEP sempre igual (BrasilAPI/ViaCEP de fora não fazem parte do teste).
  await page.route('https://brasilapi.com.br/api/cep/**', (route) =>
    route.fulfill({
      json: {
        cep: '03307000',
        state: 'SP',
        city: 'São Paulo',
        neighborhood: 'Tatuapé',
        street: 'Rua Tuiuti',
        location: { type: 'Point', coordinates: { latitude: '-23.5403', longitude: '-46.5765' } }
      }
    })
  );
  // CNPJ na Receita: o CNPJ de teste é sorteado e às vezes é de uma empresa real (uma BAIXADA reprovou a
  // construtora e travou a publicação). A resposta é a de "Receita fora do ar": a construtora fica pendente,
  // como a fila da equipe (fluxo 7) espera, e nenhum CNPJ sorteado vai para a BrasilAPI.
  await page.route('**/functions/v1/verificar-cnpj', (route) => {
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'POST, OPTIONS'
    };
    return route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers })
      : route.fulfill({ headers, json: { status: 'pendente', motivo: 'indisponivel' } });
  });
}

let n = 0;
/** Print da etapa, para docs/E2E.md. */
export async function print(page: Page, fluxo: string, legenda: string): Promise<void> {
  mkdirSync(SHOTS, { recursive: true });
  n = estado().prints.length + 1;
  const arquivo = `${String(n).padStart(2, '0')}-${fluxo}-${legenda
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 40)}.jpg`;
  // JPEG na escala da tela (não do pixel do aparelho): leve o bastante para ir para docs/.
  await page.screenshot({ path: SHOTS + arquivo, type: 'jpeg', quality: 60, scale: 'css' });
  atualizar((e) => e.prints.push({ arquivo, legenda, fluxo }));
}

/**
 * Uma conta pronta pela API (para o "outro lado" de um fluxo): o mesmo cadastro que o app faz (metadados do
 * Auth → gatilho cria a conta), e-mail já confirmado, perfil completo pela RPC finish_sign_up.
 */
export async function contaPorApi(tag: string, papel: 'trabalhador' | 'recrutador', base: string): Promise<Conta> {
  const nome = nomeDeTeste(base);
  const email = emailDeTeste(tag);
  const documento = papel === 'trabalhador' ? cpfValido(tag) : cnpjValido(tag);
  const whatsapp = whatsappDeTeste(tag);
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password: ENV.password,
    email_confirm: true,
    user_metadata: {
      nome,
      role: papel,
      tipo: papel === 'trabalhador' ? 'pedreiro' : 'construtora',
      documento,
      whatsapp,
      terms_version: (await import('../src/services/legal')).TERMS_VERSION,
      maior_de_idade: true
    }
  });
  if (error || !data.user) throw new Error(`createUser ${tag}: ${error?.message}`);
  criada(data.user.id, email);
  const c = await comoConta(email);
  // U12: o perfil se completa só com a localização.
  const p = { city: 'São Paulo, SP', lat: -23.55, lon: -46.63 };
  const { error: e2 } = await c.rpc('finish_sign_up', { p });
  if (e2) throw new Error(`finish_sign_up ${tag}: ${e2.message}`);
  const conta = { id: data.user.id, email, documento, nome, whatsapp };
  atualizar((e) => (e.contas[tag] = conta));
  return conta;
}

/** Entra pela tela de login, como a pessoa faria. */
export async function entrar(page: Page, email: string, senha = ENV.password): Promise<void> {
  await page.goto('/login');
  await page.fill('#login-identifier', email);
  await page.fill('#login-password', senha);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

/** A linha de um candidato na gestão da vaga. */
export function linhaDoCandidato(page: Page, nome: string) {
  return page
    .getByText(nome, { exact: true })
    .locator(
      'xpath=ancestor::div[.//button[@aria-label="Recusar candidato" or @aria-label="Aprovar candidato"] or .//a[@aria-label="Falar no WhatsApp"]][1]'
    );
}
