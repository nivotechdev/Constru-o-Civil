// "Ajuda" (F05): the common questions, in plain words, and a direct line to the support on WhatsApp or by
// e-mail. Opens with or without an account (the login screen links here too).
import type { ReactNode } from 'react';
import { BackBar } from '../../components/BackBar';
import { Card } from '../../components/Card';
import { Icon } from '../../components/icons/Icon';
import { useSession } from '../../hooks/useStore';
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from '../../services/features';
import { goBack } from '../../services/router';
import { whatsappUrl } from '../../utils/whatsapp';
import { WhatsAppButton } from '../../components/WhatsAppButton';

interface Question {
  q: string;
  a: string;
}

const COMMON: Question[] = [
  {
    q: 'A Bicos cobra alguma coisa?',
    a: 'Do trabalhador, nunca. A construtora publica vagas de graça e só paga se quiser colocar uma vaga no topo do mural.'
  },
  {
    q: 'Esqueci minha senha. E agora?',
    a: 'Na tela de entrar, toque em "Esqueci minha senha". Mandamos um link para o seu e-mail para criar uma senha nova.'
  },
  {
    q: 'Não recebi o e-mail de confirmação.',
    a: 'Olhe a caixa de spam e a aba "Promoções". Na tela "Confirme seu e-mail" dá para pedir o link de novo ou corrigir o e-mail.'
  },
  {
    q: 'Como excluo minha conta?',
    a: 'Em Configurações › Privacidade e dados › Excluir minha conta. Antes, mostramos o que acontece com os bicos em andamento.'
  }
];

const WORKER: Question[] = [
  {
    q: 'Como me candidato a um bico?',
    a: 'Abra a vaga no mural e toque em "Quero esse bico". A construtora recebe seu perfil e avisamos você quando ela decidir.'
  },
  {
    q: 'Quando vejo o endereço e o WhatsApp da construtora?',
    a: 'Quando ela aprovar você. Antes disso, aparecem só o bairro e a distância. Depois, o endereço completo, o mapa e o botão do WhatsApp.'
  },
  {
    q: 'Não vou poder ir. O que faço?',
    a: 'Abra "Minhas candidaturas", entre no bico e toque em "Não vou poder ir". A construtora é avisada na hora. Avise o quanto antes.'
  },
  {
    q: 'Como recebo pela diária?',
    a: 'O pagamento é combinado direto com a construtora (a forma aparece na vaga). A Bicos não entra no pagamento da diária.'
  }
];

const COMPANY: Question[] = [
  {
    q: 'Como publico uma vaga?',
    a: 'Toque em "Publicar", diga o ofício, o endereço da obra, as datas e o valor. Publicar é grátis.'
  },
  {
    q: 'Quem vê o endereço da obra?',
    a: 'Só quem você aprovar. Os outros candidatos veem o bairro e a distância.'
  },
  {
    q: 'Como falo com o trabalhador?',
    a: 'Depois de aprovar, aparece o botão "Falar no WhatsApp" na lista de candidatos e no perfil dele.'
  },
  {
    q: 'O trabalhador não apareceu.',
    a: 'A partir do dia do bico, abra o perfil dele na vaga e toque em "Não compareceu". A falta fica registrada.'
  }
];

export default function Help() {
  const session = useSession();
  const role = session?.role ?? null;
  const questions = [...(role === 'recrutador' ? COMPANY : role === 'trabalhador' ? WORKER : []), ...COMMON];
  const whatsapp = whatsappUrl(SUPPORT_WHATSAPP, 'Olá! Preciso de ajuda com a Bicos.');

  return (
    <div className="min-h-screen flex flex-col bg-concrete-50 gap-6 pb-10 lg:bg-transparent lg:min-h-0">
      <BackBar title="Ajuda" onBack={() => goBack(session ? '/configuracoes' : '/login')} />
      <div className="flex flex-col gap-6 px-4 sm:px-0">
        <Card padding="md">
          <div className="flex flex-col gap-3">
            <span className="font-semibold text-concrete-900">Falar com o suporte</span>
            <span className="text-sm text-concrete-700">
              Conte o que aconteceu e, se for sobre uma vaga, mande o código dela (ex.: BC-5001). Respondemos assim que
              possível.
            </span>
            <div className="flex flex-col sm:flex-row gap-2">
              {whatsapp ? <WhatsAppButton href={whatsapp} size="lg" fullWidth /> : null}
              <SupportLink
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Ajuda com a Bicos')}`}
                icon={<Icon name="mail" size={20} />}
              >
                Mandar e-mail
              </SupportLink>
            </div>
          </div>
        </Card>
        <div className="flex flex-col gap-2">
          <div className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">Perguntas frequentes</div>
          <div className="flex flex-col divide-y divide-concrete-200 bg-white border border-concrete-200 rounded-card overflow-hidden">
            {questions.map((item) => (
              <details key={item.q} className="group">
                <summary className="flex items-center gap-3 min-h-14 px-4 py-3 cursor-pointer list-none font-semibold text-concrete-900 hover:bg-concrete-50">
                  <span className="flex-1">{item.q}</span>
                  <span className="transition-transform group-open:rotate-180">
                    <Icon name="chevron-down" size={18} color="var(--gray-500)" />
                  </span>
                </summary>
                <p className="px-4 pb-4 text-sm text-concrete-700 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SupportLink({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full sm:w-auto sm:flex-1 inline-flex items-center justify-center gap-2 h-14 px-5 rounded-full font-semibold bg-white text-concrete-900 border border-concrete-300 hover:bg-concrete-50"
    >
      {icon}
      {children}
    </a>
  );
}
