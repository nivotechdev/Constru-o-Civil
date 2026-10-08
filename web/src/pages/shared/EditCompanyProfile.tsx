import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { Icon } from '../../components/icons/Icon';
import { Input } from '../../components/Input';
import { PhotoSlot } from '../../components/PhotoSlot';
import { Select } from '../../components/Select';
import { useDb, useUI } from '../../hooks/useStore';
import { TIPOS_OBRA } from '../../services/catalog';
import { goBack, navigate } from '../../services/router';
import { currentCompany } from '../../services/selectors';
import { COMPANY_PROFILE_DEFAULTS, COMPANY_PROFILE_KEY, type CompanyProfileUI } from '../../services/sharedUI';
import { updateCompany } from '../../services/store';

interface EditCompanyUI {
  name: string;
  tipoObra: string | undefined;
  location: string;
  whatsapp: string;
}

export default function EditCompanyProfile() {
  const company = currentCompany(useDb());
  // Seeded from the profile the first time only; the draft then survives navigation (legacy behaviour).
  const [ui, setUi] = useUI<EditCompanyUI>('edit-company-profile', () => ({
    name: company.name,
    tipoObra: company.tipoObra,
    location: company.location,
    whatsapp: company.whatsapp
  }));
  const [banner, setBanner] = useUI<CompanyProfileUI>(COMPANY_PROFILE_KEY, COMPANY_PROFILE_DEFAULTS);

  return (
    <div className="min-h-screen flex flex-col bg-concrete-50 lg:bg-transparent lg:min-h-0">
      <BackBar title="Editar empresa" onBack={() => goBack('/empresa')} />
      <div className="flex-1 flex flex-col gap-5 px-4 sm:px-6 lg:px-0 py-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-concrete-900">Foto de capa</span>
          <PhotoSlot
            shape="rect"
            height="9rem"
            placeholder="Capa da construtora"
            value={banner.capa}
            onChange={(v) => setBanner({ capa: v })}
          />
        </div>
        <div className="flex flex-col items-center gap-2">
          <PhotoSlot
            shape="circle"
            value={banner.logo}
            onChange={(v) => setBanner({ logo: v })}
            className="w-24 h-24"
            placeholder="Logo"
          />
        </div>
        <Input
          id="edit-company-name"
          label="Nome da empresa"
          icon="building-2"
          hint="É esse nome que aparece no seu perfil e nas vagas que você publicar."
          value={ui.name}
          onInput={(v) => setUi({ name: v })}
        />
        <div className="flex flex-col gap-1.5 w-full">
          <span className="text-sm font-semibold text-concrete-900">CNPJ</span>
          <div className="flex items-center gap-2 min-h-12 px-3 bg-concrete-100 rounded-control border border-concrete-200">
            <Icon name="lock" size={18} color="var(--text-subtle)" />
            <span className="flex-1 min-w-0 font-mono text-base text-concrete-500 truncate">{company.cnpj}</span>
          </div>
          <span className="text-sm text-concrete-500">
            O CNPJ é conferido na Bicos e não pode ser alterado. Fale com o suporte se precisar corrigi-lo.
          </span>
        </div>
        <Select
          label="Tipo de obra"
          options={TIPOS_OBRA}
          value={ui.tipoObra}
          onChange={(v) => setUi({ tipoObra: v })}
        />
        <Input
          id="edit-company-location"
          label="Região onde você contrata"
          icon="map-pin"
          value={ui.location}
          onInput={(v) => setUi({ location: v })}
        />
        <Input
          id="edit-company-whatsapp"
          label="WhatsApp de contato"
          icon="phone"
          value={ui.whatsapp}
          onInput={(v) => setUi({ whatsapp: v })}
        />
        <div className="pt-2 border-t border-concrete-200">
          <Button
            label="Sair da conta"
            variant="danger"
            fullWidth
            iconLeft="log-out"
            onClick={() => navigate('/login')}
          />
        </div>
      </div>
      <div className="px-4 sm:px-6 lg:px-0 py-3 bg-white shadow-bar flex gap-3 lg:static lg:bg-transparent lg:shadow-none">
        <Button label="Cancelar" variant="secondary" className="flex-1" onClick={() => navigate('/empresa')} />
        <Button
          label="Salvar alterações"
          className="flex-[1.4]"
          onClick={() => {
            updateCompany(company.id, ui);
            navigate('/empresa');
          }}
        />
      </div>
    </div>
  );
}
