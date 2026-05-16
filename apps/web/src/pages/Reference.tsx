/**
 * /referans — Türkiye'deki bankalar, resmi kurumlar, devlet kurumları.
 *
 * Sistem-geneli referans veri — tüm authenticated kullanıcılar görüntüleyebilir.
 * Read-only.
 */
import { useQuery } from '@tanstack/react-query';
import {
  Banknote,
  Building2,
  Globe,
  Landmark,
  Mail,
  Phone,
  Search,
  Shield,
} from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';

type Tab = 'banks' | 'institutions' | 'government';

interface ReferenceBank {
  id: string;
  eft_code: string | null;
  swift_code: string | null;
  name: string;
  short_name: string;
  sector: string;
  is_state_bank: boolean;
  is_participation: boolean;
  website: string | null;
  customer_service_phone: string | null;
  description: string | null;
}

interface ReferenceInstitution {
  id: string;
  code: string;
  name: string;
  short_name: string;
  category: string;
  parent_ministry: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  description: string | null;
}

interface ReferenceGovAgency {
  id: string;
  code: string;
  name: string;
  short_name: string;
  agency_type: string;
  website: string | null;
  phone: string | null;
  description: string | null;
}

interface ReferenceSummary {
  banks: number;
  institutions: number;
  government_agencies: number;
}

const SECTOR_LABEL: Record<string, string> = {
  state: 'Kamu',
  commercial: 'Özel Ticari',
  participation: 'Katılım',
  development: 'Kalkınma / Yatırım',
  investment: 'Yatırım',
  foreign: 'Yabancı',
};

const CATEGORY_LABEL: Record<string, string> = {
  tax: 'Vergi',
  social_security: 'Sosyal Güvenlik',
  chamber: 'Oda',
  professional: 'Mesleki Kuruluş',
  judicial: 'Adli',
  notary: 'Noterlik',
  municipality: 'Belediye',
  other: 'Diğer',
};

const AGENCY_TYPE_LABEL: Record<string, string> = {
  ministry: 'Bakanlık',
  presidential: 'Cumhurbaşkanlığı',
  authority: 'Başkanlık / Otorite',
  undersecretariat: 'Müsteşarlık',
};

export function ReferencePage() {
  const [tab, setTab] = useState<Tab>('banks');
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('');
  const [category, setCategory] = useState('');

  const summary = useQuery({
    queryKey: ['reference-summary'],
    queryFn: async () =>
      (await api.get<{ data: ReferenceSummary }>('/reference/summary')).data.data,
  });

  const banksQ = useQuery({
    queryKey: ['reference-banks', search, sector],
    enabled: tab === 'banks',
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (sector) params.set('sector', sector);
      const url = `/reference/banks${params.toString() ? '?' + params.toString() : ''}`;
      return (await api.get<{ data: ReferenceBank[] }>(url)).data.data;
    },
  });

  const institutionsQ = useQuery({
    queryKey: ['reference-institutions', search, category],
    enabled: tab === 'institutions',
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      const url = `/reference/institutions${params.toString() ? '?' + params.toString() : ''}`;
      return (await api.get<{ data: ReferenceInstitution[] }>(url)).data.data;
    },
  });

  const governmentQ = useQuery({
    queryKey: ['reference-government', search],
    enabled: tab === 'government',
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const url = `/reference/government-agencies${params.toString() ? '?' + params.toString() : ''}`;
      return (await api.get<{ data: ReferenceGovAgency[] }>(url)).data.data;
    },
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Referans</p>
        <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
          <Globe className="size-6" />
          Türkiye Referans Veri
        </h1>
        <p className="text-sm text-brand-500 dark:text-slate-400 mt-1 max-w-3xl">
          Türkiye'deki tüm bankaların, resmi kurumların ve devlet kurumlarının temel bilgileri.
          Cari ekleme, ödeme yapma, çek/teminat işlemlerinde referans olarak kullanılabilir.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <div className="flex gap-1 bg-brand-100 dark:bg-slate-800 rounded p-1">
          <TabButton
            active={tab === 'banks'}
            onClick={() => {
              setTab('banks');
              setSector('');
              setCategory('');
            }}
            icon={<Banknote className="size-4" />}
            label="Bankalar"
            count={summary.data?.banks}
          />
          <TabButton
            active={tab === 'institutions'}
            onClick={() => {
              setTab('institutions');
              setSector('');
              setCategory('');
            }}
            icon={<Building2 className="size-4" />}
            label="Resmi Kurumlar"
            count={summary.data?.institutions}
          />
          <TabButton
            active={tab === 'government'}
            onClick={() => {
              setTab('government');
              setSector('');
              setCategory('');
            }}
            icon={<Landmark className="size-4" />}
            label="Devlet Kurumları"
            count={summary.data?.government_agencies}
          />
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-brand-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ad veya kod ile ara…"
            className="pl-8 pr-3 py-1.5 text-sm rounded border border-brand-200 dark:border-slate-700 bg-white dark:bg-slate-900 min-w-[200px]"
          />
        </div>
      </div>

      {/* Filtre */}
      {tab === 'banks' && (
        <div className="flex flex-wrap gap-1 mb-3">
          <FilterChip active={!sector} onClick={() => setSector('')} label="Tümü" />
          {Object.entries(SECTOR_LABEL).map(([k, v]) => (
            <FilterChip
              key={k}
              active={sector === k}
              onClick={() => setSector(k)}
              label={v}
            />
          ))}
        </div>
      )}
      {tab === 'institutions' && (
        <div className="flex flex-wrap gap-1 mb-3">
          <FilterChip active={!category} onClick={() => setCategory('')} label="Tümü" />
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
            <FilterChip
              key={k}
              active={category === k}
              onClick={() => setCategory(k)}
              label={v}
            />
          ))}
        </div>
      )}

      {/* İçerik */}
      <div className="card">
        {tab === 'banks' && <BanksTable q={banksQ} />}
        {tab === 'institutions' && <InstitutionsTable q={institutionsQ} />}
        {tab === 'government' && <GovernmentTable q={governmentQ} />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded flex items-center gap-1.5 ${
        active
          ? 'bg-white dark:bg-slate-900 text-brand-900 dark:text-slate-100 shadow'
          : 'text-brand-600 dark:text-slate-400'
      }`}
    >
      {icon}
      {label}
      {count !== undefined && (
        <span className="text-[10px] font-mono bg-brand-100 dark:bg-slate-700 text-brand-700 dark:text-slate-300 px-1.5 py-0.5 rounded">
          {count}
        </span>
      )}
    </button>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border ${
        active
          ? 'bg-brand-900 text-white border-brand-900 dark:bg-brand-300 dark:text-brand-900'
          : 'bg-white dark:bg-slate-900 text-brand-700 dark:text-slate-300 border-brand-200 dark:border-slate-700 hover:bg-brand-50'
      }`}
    >
      {label}
    </button>
  );
}

function BanksTable({ q }: { q: ReturnType<typeof useQuery<ReferenceBank[]>> }) {
  if (q.isLoading) return <p className="text-brand-500 text-sm">Yükleniyor…</p>;
  if (!q.data || q.data.length === 0)
    return <p className="text-brand-500 text-sm text-center py-8">Sonuç bulunamadı.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100">
            <th className="py-2 px-2">Banka</th>
            <th className="py-2 px-2">EFT</th>
            <th className="py-2 px-2">SWIFT</th>
            <th className="py-2 px-2">Tip</th>
            <th className="py-2 px-2">İletişim</th>
            <th className="py-2 px-2">Web</th>
          </tr>
        </thead>
        <tbody>
          {q.data.map((b) => (
            <tr key={b.id} className="border-b border-brand-50 hover:bg-brand-50/50">
              <td className="py-2 px-2 font-medium">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-brand-900 dark:text-slate-100">{b.short_name}</span>
                  {b.is_state_bank && (
                    <span className="text-[10px] uppercase tracking-wide bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                      Kamu
                    </span>
                  )}
                  {b.is_participation && (
                    <span className="text-[10px] uppercase tracking-wide bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                      Katılım
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-brand-400 mt-0.5">{b.name}</p>
              </td>
              <td className="py-2 px-2 font-mono text-xs">{b.eft_code ?? '-'}</td>
              <td className="py-2 px-2 font-mono text-xs">{b.swift_code ?? '-'}</td>
              <td className="py-2 px-2 text-xs text-brand-600">
                {SECTOR_LABEL[b.sector] ?? b.sector}
              </td>
              <td className="py-2 px-2 text-xs">
                {b.customer_service_phone && (
                  <a
                    href={`tel:${b.customer_service_phone}`}
                    className="inline-flex items-center gap-1 text-brand-700 hover:underline"
                  >
                    <Phone className="size-3" />
                    {b.customer_service_phone}
                  </a>
                )}
              </td>
              <td className="py-2 px-2 text-xs">
                {b.website && (
                  <a
                    href={b.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <Globe className="size-3" />
                    Site
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InstitutionsTable({
  q,
}: {
  q: ReturnType<typeof useQuery<ReferenceInstitution[]>>;
}) {
  if (q.isLoading) return <p className="text-brand-500 text-sm">Yükleniyor…</p>;
  if (!q.data || q.data.length === 0)
    return <p className="text-brand-500 text-sm text-center py-8">Sonuç bulunamadı.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100">
            <th className="py-2 px-2">Kurum</th>
            <th className="py-2 px-2">Kategori</th>
            <th className="py-2 px-2">Üst Bakanlık</th>
            <th className="py-2 px-2">İletişim</th>
            <th className="py-2 px-2">Web</th>
          </tr>
        </thead>
        <tbody>
          {q.data.map((i) => (
            <tr key={i.id} className="border-b border-brand-50 hover:bg-brand-50/50">
              <td className="py-2 px-2 font-medium">
                <p className="text-brand-900 dark:text-slate-100">{i.short_name}</p>
                <p className="text-[10px] text-brand-400 mt-0.5">{i.name}</p>
              </td>
              <td className="py-2 px-2 text-xs text-brand-600">
                {CATEGORY_LABEL[i.category] ?? i.category}
              </td>
              <td className="py-2 px-2 text-xs text-brand-700">{i.parent_ministry ?? '-'}</td>
              <td className="py-2 px-2 text-xs">
                {i.phone && (
                  <a
                    href={`tel:${i.phone}`}
                    className="inline-flex items-center gap-1 text-brand-700 hover:underline"
                  >
                    <Phone className="size-3" />
                    {i.phone}
                  </a>
                )}
                {i.email && (
                  <a
                    href={`mailto:${i.email}`}
                    className="inline-flex items-center gap-1 text-brand-700 hover:underline ml-2"
                  >
                    <Mail className="size-3" />
                  </a>
                )}
              </td>
              <td className="py-2 px-2 text-xs">
                {i.website && (
                  <a
                    href={i.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <Globe className="size-3" />
                    Site
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GovernmentTable({
  q,
}: {
  q: ReturnType<typeof useQuery<ReferenceGovAgency[]>>;
}) {
  if (q.isLoading) return <p className="text-brand-500 text-sm">Yükleniyor…</p>;
  if (!q.data || q.data.length === 0)
    return <p className="text-brand-500 text-sm text-center py-8">Sonuç bulunamadı.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100">
            <th className="py-2 px-2">Kurum</th>
            <th className="py-2 px-2">Tip</th>
            <th className="py-2 px-2">İletişim</th>
            <th className="py-2 px-2">Web</th>
          </tr>
        </thead>
        <tbody>
          {q.data.map((g) => (
            <tr key={g.id} className="border-b border-brand-50 hover:bg-brand-50/50">
              <td className="py-2 px-2 font-medium">
                <div className="flex items-center gap-2 flex-wrap">
                  <Shield className="size-4 text-brand-400" />
                  <span className="text-brand-900 dark:text-slate-100">{g.short_name}</span>
                </div>
                <p className="text-[10px] text-brand-400 mt-0.5">{g.name}</p>
              </td>
              <td className="py-2 px-2 text-xs text-brand-600">
                {AGENCY_TYPE_LABEL[g.agency_type] ?? g.agency_type}
              </td>
              <td className="py-2 px-2 text-xs">
                {g.phone && (
                  <a
                    href={`tel:${g.phone}`}
                    className="inline-flex items-center gap-1 text-brand-700 hover:underline"
                  >
                    <Phone className="size-3" />
                    {g.phone}
                  </a>
                )}
              </td>
              <td className="py-2 px-2 text-xs">
                {g.website && (
                  <a
                    href={g.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <Globe className="size-3" />
                    Site
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
