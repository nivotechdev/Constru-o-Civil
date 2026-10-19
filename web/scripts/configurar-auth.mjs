#!/usr/bin/env node
// L04/L05/L08 — Configura o Authentication de um projeto Supabase pela Management API, igual em staging e
// produção: SMTP próprio (Brevo), os 4 e-mails em português (supabase/email-templates/), Site URL e Redirect
// URLs, captcha (Turnstile) e senha mínima. Nada de segredo no repositório: tudo vem do ambiente.
//
//   SUPABASE_ACCESS_TOKEN=…  PROJECT_REF=<ref>  SITE_URL=https://bicos.nivotech.com.br \
//   BREVO_SMTP_USER=…@smtp-brevo.com  BREVO_SMTP_KEY=…  TURNSTILE_SECRET=… \
//     node scripts/configurar-auth.mjs            # aplica
//   … node scripts/configurar-auth.mjs --mostrar  # só mostra o que mudaria (sem os segredos)
//
// A produção (ppnxdajiihsjaojxokzh) só com CONFIRMO_PRODUCAO=sim — e só depois do "pode" do responsável.
import { readFileSync } from 'node:fs';

const env = process.env;
const dryRun = process.argv.includes('--mostrar');
const need = (k) => {
  if (!env[k]) {
    console.error(`Falta ${k}.`);
    process.exit(2);
  }
  return env[k];
};
const ref = need('PROJECT_REF');
if (ref === 'ppnxdajiihsjaojxokzh' && env.CONFIRMO_PRODUCAO !== 'sim') {
  console.error('Esse é o projeto de PRODUÇÃO. Rode com CONFIRMO_PRODUCAO=sim (só com aprovação).');
  process.exit(1);
}
const site = need('SITE_URL').replace(/\/+$/, '');
const template = (f) => readFileSync(new URL(`../supabase/email-templates/${f}`, import.meta.url), 'utf8');

const hasSmtp = Boolean(env.BREVO_SMTP_USER) || ref === 'ppnxdajiihsjaojxokzh';
const config = {
  site_url: site + '/',
  uri_allow_list: [...new Set([site + '/**', ...(env.EXTRA_REDIRECTS ? env.EXTRA_REDIRECTS.split(',') : [])])].join(
    ','
  ),
  mailer_autoconfirm: false,
  password_min_length: 8,
  mailer_otp_exp: 3600,
  // SMTP próprio (Brevo). Remetente de domínio autenticado na Brevo (SPF/DKIM/DMARC — CHECKLIST-LANCAMENTO, L04).
  // Sem BREVO_SMTP_USER (só no staging, para os primeiros testes) fica o e-mail padrão do Supabase: só entrega
  // para membros da equipe do projeto e poucos por hora. Na produção o SMTP é obrigatório.
  ...(hasSmtp
    ? {
        smtp_host: 'smtp-relay.brevo.com',
        smtp_port: '587',
        smtp_user: need('BREVO_SMTP_USER'),
        smtp_pass: need('BREVO_SMTP_KEY'),
        smtp_admin_email: env.SMTP_SENDER ?? 'nao-responda@nivotech.com.br',
        smtp_sender_name: 'Bicos',
        smtp_max_frequency: 60,
        rate_limit_email_sent: Number(env.RATE_LIMIT_EMAIL ?? 100)
      }
    : {}),
  // Os e-mails em português só podem ser trocados com SMTP próprio (o plano grátis recusa com o e-mail padrão).
  ...(hasSmtp
    ? {
        mailer_subjects_confirmation: 'Confirme seu e-mail na Bicos',
        mailer_templates_confirmation_content: template('confirmacao.html'),
        mailer_subjects_recovery: 'Criar uma senha nova na Bicos',
        mailer_templates_recovery_content: template('redefinir-senha.html'),
        mailer_subjects_email_change: 'Confirme o novo e-mail da sua conta na Bicos',
        mailer_templates_email_change_content: template('troca-de-email.html'),
        mailer_subjects_magic_link: 'Seu link para entrar na Bicos',
        mailer_templates_magic_link_content: template('link-de-acesso.html')
      }
    : {}),
  ...(env.TURNSTILE_SECRET
    ? {
        security_captcha_enabled: true,
        security_captcha_provider: 'turnstile',
        security_captcha_secret: env.TURNSTILE_SECRET
      }
    : {})
};

const SECRET = new Set(['smtp_pass', 'security_captcha_secret']);
const shown = Object.fromEntries(
  Object.entries(config).map(([k, v]) => [
    k,
    SECRET.has(k) ? '••••' : typeof v === 'string' && v.length > 120 ? `<${v.length} caracteres>` : v
  ])
);
console.log(`Projeto ${ref}:`, shown);
if (dryRun) process.exit(0);

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${need('SUPABASE_ACCESS_TOKEN')}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(config)
});
if (!res.ok) {
  console.error(`Falhou (${res.status}): ${(await res.text()).slice(0, 500)}`);
  process.exit(1);
}
console.log('Authentication configurado.');
