// "Completar cadastro" (L13/U18): a Google account that has no side yet. The same data as the e-mail sign-up
// (side, name, CPF/CNPJ, WhatsApp, 18+, terms) on one screen, then the usual "Completar perfil". U18: the side
// chosen before going to Google comes marked, the name starts with the one from Google, and the CPF/CNPJ and the
// WhatsApp are checked against other accounts here (U10), with the same messages as the sign-up.
import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { FieldError } from '../../components/FieldError';
import { FlowHeading, FlowLayout } from '../../components/FlowLayout';
import { Input } from '../../components/Input';
import { RadioCard } from '../../components/Radio';
import { completeOAuthSignUp, isFreeForSignUp, oauthIdentity, signOut, takeGoogleRole } from '../../services/auth';
import { errorMessage, ServiceError } from '../../services/errors';
import { TERMS_VERSION } from '../../services/legal';
import { navigate } from '../../services/router';
import type { Role } from '../../types/models';
import { isValidCnpj, isValidCpf } from '../../utils/document';
import { isValidMobile, maskCNPJ, maskCPF, maskPhone } from '../../utils/format';

type FieldKey = 'name' | 'contact' | 'doc' | 'whatsapp' | 'adult' | 'accepted';
type Errors = Partial<Record<FieldKey, string>>;

const docLabel = (doc: string) => (doc.replace(/\D/g, '').length === 14 ? 'CNPJ' : 'CPF');

export default function CompleteSignup() {
  const [role, setRole] = useState<Role>(() => takeGoogleRole() ?? 'trabalhador');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [doc, setDoc] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [contact, setContact] = useState('');
  const [adult, setAdult] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    void oauthIdentity()
      .catch(() => null)
      .then((who) => {
        if (!live || !who) return;
        setEmail(who.email);
        setName((typed) => typed || who.name);
      });
    return () => {
      live = false;
    };
  }, []);

  const company = role === 'recrutador';

  function clear(key: FieldKey) {
    setErrors((e) => ({ ...e, [key]: undefined }));
    setError(null);
  }

  function validate(): Errors {
    const next: Errors = {};
    // The same rules as the sign-up steps.
    const typed = name.trim();
    if (company && typed.length < 3) next.name = 'Informe o nome da empresa.';
    if (!company && !typed) next.name = 'Informe o nome completo.';
    else if (!company && typed.split(/\s+/).length < 2) next.name = 'Informe nome e sobrenome.';
    const person = contact.trim();
    if (company && person.length < 2) next.contact = 'Escreva seu nome.';
    else if (company && person.length > 60) next.contact = 'Use até 60 caracteres.';
    const validDoc = company ? isValidCnpj(doc) || isValidCpf(doc) : isValidCpf(doc);
    if (!validDoc)
      next.doc = company ? 'CNPJ ou CPF inválido. Confira os números.' : 'CPF inválido. Confira os números.';
    if (!isValidMobile(whatsapp)) next.whatsapp = 'Use o celular com DDD (11 números).';
    if (!adult) next.adult = 'A Bicos é só para maiores de 18 anos.';
    if (!accepted) next.accepted = 'Aceite os Termos de uso e a Política de privacidade.';
    return next;
  }

  async function save() {
    if (saving) return;
    const found = validate();
    setErrors(found);
    setError(null);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      // U10: the CPF/CNPJ and the WhatsApp can't be another account's.
      const [docFree, phoneFree] = await Promise.all([
        isFreeForSignUp('documento', doc),
        isFreeForSignUp('whatsapp', whatsapp)
      ]);
      if (!docFree || !phoneFree) {
        setErrors({
          ...(docFree
            ? {}
            : {
                doc: `Esse ${docLabel(doc)} já tem conta na Bicos. Saia e entre com o e-mail dessa conta.`
              }),
          ...(phoneFree ? {} : { whatsapp: 'Esse WhatsApp já está em outra conta da Bicos. Use outro número.' })
        });
        return;
      }
      await completeOAuthSignUp({
        role,
        name,
        doc,
        whatsapp,
        acceptedTermsVersion: TERMS_VERSION,
        adult,
        ...(company ? { contactName: contact } : {})
      });
      navigate('/mural', { replace: true });
    } catch (e: unknown) {
      setError(
        e instanceof ServiceError && e.code === 'conflito'
          ? 'Não deu para criar a conta com esses dados. Confira o documento e o WhatsApp.'
          : errorMessage(e)
      );
    } finally {
      setSaving(false);
    }
  }

  const leave = () => void signOut().finally(() => navigate('/login', { replace: true }));

  return (
    <FlowLayout
      className="gap-6"
      footer={
        <>
          {error ? <FieldError message={error} /> : null}
          <Button label="Criar minha conta" size="lg" fullWidth loading={saving} onClick={() => void save()} />
          <Button label="Sair e entrar com outra conta" variant="ghost" fullWidth onClick={leave} />
        </>
      }
    >
      <FlowHeading
        overline="Continuar com o Google"
        title="Falta pouco"
        help={
          email ? (
            <>
              Você entrou com <span className="font-semibold text-concrete-900 break-all">{email}</span>. Complete seus
              dados para criar a conta.
            </>
          ) : (
            'Complete seus dados para criar a conta.'
          )
        }
      />

      <div className="flex flex-col gap-3" role="radiogroup" aria-label="Como você vai usar o Bicos?">
        <span className="text-sm font-semibold text-concrete-900">Como você vai usar o Bicos?</span>
        <RadioCard
          name="perfil-google"
          icon="hard-hat"
          label="Quero pegar bico"
          description="Sou pedreiro, servente, pintor ou eletricista"
          checked={role === 'trabalhador'}
          onChange={() => {
            setRole('trabalhador');
            setErrors({});
          }}
        />
        <RadioCard
          name="perfil-google"
          icon="building-2"
          label="Quero contratar"
          description="Represento uma construtora ou uma obra"
          checked={company}
          onChange={() => {
            setRole('recrutador');
            setErrors({});
          }}
        />
      </div>

      <Input
        id="completar-nome"
        label={company ? 'Nome da empresa' : 'Nome completo'}
        icon={company ? 'building-2' : 'user'}
        autoComplete={company ? 'organization' : 'name'}
        value={name}
        error={errors.name}
        onInput={(v) => {
          setName(v);
          clear('name');
        }}
      />
      {company ? (
        <Input
          id="completar-responsavel"
          label="Quem vai falar com os candidatos"
          icon="user"
          autoComplete="name"
          value={contact}
          error={errors.contact}
          onInput={(v) => {
            setContact(v);
            clear('contact');
          }}
        />
      ) : null}
      <Input
        id="completar-documento"
        label={company ? 'CNPJ ou CPF' : 'CPF'}
        icon="id-card"
        mono
        inputMode="numeric"
        autoComplete="off"
        placeholder={company ? '00.000.000/0000-00' : '000.000.000-00'}
        value={doc}
        error={errors.doc}
        onInput={(v) => {
          setDoc(company && v.replace(/\D/g, '').length > 11 ? maskCNPJ(v) : maskCPF(v));
          clear('doc');
        }}
      />
      <Input
        id="completar-whatsapp"
        label="WhatsApp"
        icon="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="(11) 99999-9999"
        hint="A construtora ou o trabalhador só vê o número depois da aprovação."
        value={whatsapp}
        error={errors.whatsapp}
        onInput={(v) => {
          setWhatsapp(maskPhone(v));
          clear('whatsapp');
        }}
      />
      <div className="flex flex-col gap-2">
        <Checkbox
          label="Tenho 18 anos ou mais"
          checked={adult}
          onChange={(v) => {
            setAdult(v);
            clear('adult');
          }}
        />
        {errors.adult ? <FieldError message={errors.adult} /> : null}
        <Checkbox
          label="Li e aceito os Termos de uso e a Política de privacidade"
          checked={accepted}
          onChange={(v) => {
            setAccepted(v);
            clear('accepted');
          }}
        />
        {errors.accepted ? <FieldError message={errors.accepted} /> : null}
        <div className="flex gap-4 pl-9">
          <button type="button" className="text-sm text-brand-600 underline" onClick={() => navigate('/termos')}>
            Termos de uso
          </button>
          <button type="button" className="text-sm text-brand-600 underline" onClick={() => navigate('/privacidade')}>
            Política de privacidade
          </button>
        </div>
      </div>
    </FlowLayout>
  );
}
