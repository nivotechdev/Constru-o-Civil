// "Completar cadastro" (L13): a Google account that has no side yet. The same data as the e-mail sign-up
// (side, name, CPF/CNPJ, WhatsApp, 18+, terms), then the usual "Completar perfil". Everything typed stays
// in this screen.
import { useState } from 'react';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { FieldError } from '../../components/FieldError';
import { Input } from '../../components/Input';
import { Tag } from '../../components/Tag';
import { useAction } from '../../hooks/useAction';
import { completeOAuthSignUp, signOut } from '../../services/auth';
import { serviceError } from '../../services/errors';
import { TERMS_VERSION } from '../../services/legal';
import { navigate } from '../../services/router';
import type { Role } from '../../types/models';
import { isValidMobile, maskCNPJ, maskCPF, maskPhone } from '../../utils/format';

export default function CompleteSignup() {
  const [role, setRole] = useState<Role>('trabalhador');
  const [name, setName] = useState('');
  const [doc, setDoc] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [contact, setContact] = useState('');
  const [adult, setAdult] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const save = useAction(
    async () => {
      if (name.trim().length < 3) throw serviceError('validacao', 'Informe seu nome completo.');
      if (!isValidMobile(whatsapp)) throw serviceError('validacao', 'WhatsApp: use o celular com DDD (11 números).');
      if (!accepted) throw serviceError('validacao', 'Aceite os Termos de uso e a Política de privacidade.');
      await completeOAuthSignUp({
        role,
        name,
        doc,
        whatsapp,
        acceptedTermsVersion: TERMS_VERSION,
        adult,
        ...(role === 'recrutador' ? { contactName: contact } : {})
      });
    },
    () => navigate('/mural', { replace: true })
  );
  const leave = () => void signOut().finally(() => navigate('/login', { replace: true }));

  return (
    <div className="min-h-screen bg-white">
      <form
        className="max-w-app mx-auto px-6 sm:px-8 pt-10 pb-10 flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          void save.run();
        }}
      >
        <div className="flex flex-col gap-2">
          <h1 className="font-display font-bold text-3xl text-concrete-900">Falta pouco</h1>
          <p className="text-base text-concrete-700">Conte quem você é na Bicos para terminar a conta.</p>
        </div>
        <div className="flex flex-col gap-2.5">
          <span className="text-sm font-semibold text-concrete-900">Você é</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Você é">
            <Tag label="Trabalhador" selected={role === 'trabalhador'} onClick={() => setRole('trabalhador')} />
            <Tag
              label="Construtora ou recrutador"
              selected={role === 'recrutador'}
              onClick={() => setRole('recrutador')}
            />
          </div>
        </div>
        <Input
          id="completar-nome"
          label={role === 'recrutador' ? 'Nome da empresa' : 'Nome completo'}
          icon={role === 'recrutador' ? 'building-2' : 'user'}
          autoComplete={role === 'recrutador' ? 'organization' : 'name'}
          value={name}
          onInput={(v) => {
            setName(v);
            save.reset();
          }}
        />
        {role === 'recrutador' ? (
          <Input
            id="completar-responsavel"
            label="Quem vai falar com os candidatos"
            icon="user"
            autoComplete="name"
            value={contact}
            onInput={setContact}
          />
        ) : null}
        <Input
          id="completar-documento"
          label={role === 'recrutador' ? 'CNPJ ou CPF' : 'CPF'}
          icon="id-card"
          mono
          inputMode="numeric"
          autoComplete="off"
          value={doc}
          onInput={(v) => {
            setDoc(role === 'recrutador' && v.replace(/\D/g, '').length > 11 ? maskCNPJ(v) : maskCPF(v));
            save.reset();
          }}
        />
        <Input
          id="completar-whatsapp"
          label="WhatsApp"
          icon="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={whatsapp}
          onInput={(v) => {
            setWhatsapp(maskPhone(v));
            save.reset();
          }}
        />
        <div className="flex flex-col gap-2">
          <Checkbox label="Tenho 18 anos ou mais" checked={adult} onChange={setAdult} />
          <Checkbox
            label="Li e aceito os Termos de uso e a Política de privacidade"
            checked={accepted}
            onChange={setAccepted}
          />
          <div className="flex gap-4 pl-9">
            <button type="button" className="text-sm text-brand-600 underline" onClick={() => navigate('/termos')}>
              Termos de uso
            </button>
            <button type="button" className="text-sm text-brand-600 underline" onClick={() => navigate('/privacidade')}>
              Política de privacidade
            </button>
          </div>
        </div>
        {save.error ? <FieldError message={save.error} /> : null}
        <Button label="Criar minha conta" type="submit" size="lg" fullWidth loading={save.loading} />
        <Button label="Sair e entrar com outra conta" variant="ghost" fullWidth onClick={leave} />
      </form>
    </div>
  );
}
