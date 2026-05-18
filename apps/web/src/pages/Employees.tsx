/**
 * /employees — Personel listesi + ekleme.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calculator,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { ExportButton } from '../components/ExportButton';
import { SavedFilters } from '../components/SavedFilters';
import { TruncatedListWarning } from '../components/TruncatedListWarning';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fmtTRY } from '../lib/formatting';

interface Employee {
  id: string;
  full_name: string;
  tc_kimlik_no: string | null;
  hire_date: string;
  gross_salary: string;
  marital_status: string;
  kids_count: string;
  spouse_working: boolean;
  status: string;
  department: string | null;
  position: string | null;
  email: string | null;
  phone: string | null;
  tenant_name?: string | null;
}

export function EmployeesPage() {
  const active = useAuth((s) => s.active);
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const list = useQuery({
    queryKey: ['employees', active.tenantSlug, active.aggregate],
    enabled: !!active.tenantSlug || active.aggregate === true,
    queryFn: async () => {
      const res = await api.get<{
        data: Employee[];
        total?: number;
        limit?: number;
        truncated?: boolean;
        count?: number;
      }>('/employees');
      return res.data;
    },
  });
  const employeeRows = list.data?.data ?? [];

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/employees/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
    onError: (e) => {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      alert(
        err.response?.data?.message ??
          err.response?.data?.error ??
          (e as Error).message ??
          'Silme işlemi başarısız',
      );
    },
  });

  if (!active.tenantSlug && !active.aggregate) {
    return (
      <div className="p-10 max-w-3xl mx-auto text-center">
        <div className="card">
          <p className="text-brand-700 font-medium">Tenant seçilmedi</p>
          <p className="text-sm text-brand-500 mt-1">
            Üst köşeden bir şirket seç veya "Tüm Şirketler" seç.
          </p>
        </div>
      </div>
    );
  }

  const totalGross = employeeRows.reduce((sum, e) => sum + Number(e.gross_salary), 0);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">İnsan Kaynakları</p>
          <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="size-6" />
            Personel Listesi
          </h1>
          <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
            Personel bilgileri + brüt maaş. Bordrolar /payroll'da otomatik üretilir.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SavedFilters module="employees" currentFilters={{}} onApply={() => {}} />
          <ExportButton resource="employees" label="Excel" />
          <button
            onClick={() => setShowForm(true)}
            className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
          >
            <Plus className="size-4" />
            Yeni Personel
          </button>
        </div>
      </header>

      <TruncatedListWarning meta={list.data} />

      {employeeRows.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-3 mb-6">
          <div className="card">
            <p className="text-[10px] uppercase tracking-wide text-brand-500">Aktif Personel</p>
            <p className="text-xl font-semibold mt-1">{employeeRows.length}</p>
          </div>
          <div className="card">
            <p className="text-[10px] uppercase tracking-wide text-brand-500">Aylık Brüt Toplam</p>
            <p className="text-xl font-semibold font-mono mt-1">{fmtTRY(totalGross)}</p>
          </div>
          <div className="card">
            <p className="text-[10px] uppercase tracking-wide text-brand-500">Tahmini Yıllık</p>
            <p className="text-xl font-semibold font-mono mt-1 text-amber-700 dark:text-amber-400">
              {fmtTRY(totalGross * 12)}
            </p>
          </div>
        </div>
      )}

      {showForm && <EmployeeForm onClose={() => setShowForm(false)} />}

      {list.isLoading && <p className="text-brand-500 text-sm">Yükleniyor…</p>}

      {list.data && employeeRows.length === 0 && !showForm && (
        <div className="card text-center py-12">
          <Users className="size-12 mx-auto text-brand-300 mb-2" />
          <p className="text-brand-700 dark:text-slate-300 font-medium">Henüz personel yok.</p>
        </div>
      )}

      {employeeRows.length > 0 && (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100 dark:border-slate-800">
                <th className="py-2.5 px-3">Ad Soyad</th>
                <th className="py-2.5 px-3">Pozisyon</th>
                <th className="py-2.5 px-3">İşe Başlama</th>
                <th className="py-2.5 px-3 text-right">Brüt Maaş</th>
                <th className="py-2.5 px-3">Medeni</th>
                <th className="py-2.5 px-3 text-right">Çocuk</th>
                <th className="py-2.5 px-3">İletişim</th>
                <th className="py-2.5 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {employeeRows.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-brand-50 dark:border-slate-800/50 hover:bg-brand-50/30 dark:hover:bg-slate-800/30"
                >
                  <td className="py-2 px-3 font-medium">
                    <div className="flex items-center gap-2 flex-wrap">
                      <User className="size-4 text-brand-400" />
                      <span className="text-brand-900 dark:text-slate-100">{e.full_name}</span>
                      {active.aggregate && e.tenant_name && (
                        <span className="text-[10px] uppercase tracking-wide bg-brand-100 dark:bg-slate-700 text-brand-700 dark:text-slate-300 px-1.5 py-0.5 rounded">
                          {e.tenant_name}
                        </span>
                      )}
                    </div>
                    {e.department && (
                      <p className="text-[10px] text-brand-400">{e.department}</p>
                    )}
                  </td>
                  <td className="py-2 px-3 text-brand-700 dark:text-slate-300 text-xs">
                    {e.position ?? '-'}
                  </td>
                  <td className="py-2 px-3 font-mono text-xs">{e.hire_date}</td>
                  <td className="py-2 px-3 text-right font-mono">{fmtTRY(e.gross_salary)}</td>
                  <td className="py-2 px-3 text-xs">
                    {e.marital_status === 'married' ? 'Evli' : 'Bekar'}
                  </td>
                  <td className="py-2 px-3 text-right text-xs">{e.kids_count}</td>
                  <td className="py-2 px-3 text-xs text-brand-500">
                    {e.email ?? e.phone ?? '-'}
                  </td>
                  <td className="py-2 px-3">
                    <button
                      onClick={() => {
                        if (confirm(`"${e.full_name}" arşivlensin mi?`)) remove.mutate(e.id);
                      }}
                      className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface CalcResult {
  gross: number;
  sgk_employee: number;
  unemployment_employee: number;
  income_tax: number;
  stamp_tax: number;
  agi: number;
  net: number;
  sgk_employer: number;
  unemployment_employer: number;
  total_employer_cost: number;
}

function EmployeeForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [tcNo, setTcNo] = useState('');
  const [hireDate, setHireDate] = useState(new Date().toISOString().slice(0, 10));
  const [gross, setGross] = useState('');
  const [marital, setMarital] = useState<'single' | 'married'>('single');
  const [kids, setKids] = useState(0);
  const [spouseWorking, setSpouseWorking] = useState(false);
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [iban, setIban] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [calc, setCalc] = useState<CalcResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: CalcResult }>('/employees/calculate', {
        gross_monthly: Number(gross),
        marital_status: marital,
        kids_count: kids,
        spouse_working: spouseWorking,
      });
      return res.data.data;
    },
    onSuccess: (data) => setCalc(data),
  });

  const create = useMutation({
    mutationFn: async () => {
      await api.post('/employees', {
        full_name: fullName,
        tc_kimlik_no: tcNo || null,
        hire_date: hireDate,
        gross_salary: gross,
        marital_status: marital,
        kids_count: kids,
        spouse_working: spouseWorking,
        department: department || null,
        position: position || null,
        iban: iban || null,
        email: email || null,
        phone: phone || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      onClose();
    },
    onError: (e) => setError((e as Error).message),
  });

  return (
    <div className="card mb-4 border-brand-300 dark:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-brand-900 dark:text-slate-100">Yeni Personel</h3>
        <button
          onClick={onClose}
          className="text-brand-500 hover:text-brand-900 dark:text-slate-400"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Ad Soyad *"
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm sm:col-span-2"
        />
        <input
          value={tcNo}
          onChange={(e) => setTcNo(e.target.value)}
          placeholder="TC Kimlik No (11 hane)"
          maxLength={11}
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm font-mono"
        />
        <input
          value={hireDate}
          onChange={(e) => setHireDate(e.target.value)}
          type="date"
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        />
        <input
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          placeholder="Pozisyon (örn Muhasebe Müdürü)"
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        />
        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="Departman"
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        />
        <input
          value={gross}
          onChange={(e) => setGross(e.target.value)}
          type="number"
          step="0.01"
          placeholder="Aylık brüt maaş (TL) *"
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        />
        <select
          value={marital}
          onChange={(e) => setMarital(e.target.value as 'single' | 'married')}
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        >
          <option value="single">Bekar</option>
          <option value="married">Evli</option>
        </select>
        <label className="text-xs text-brand-500 dark:text-slate-400">
          Çocuk sayısı: <strong>{kids}</strong>
          <input
            type="range"
            min={0}
            max={6}
            value={kids}
            onChange={(e) => setKids(Number(e.target.value))}
            className="w-full"
          />
        </label>
        {marital === 'married' && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={spouseWorking}
              onChange={(e) => setSpouseWorking(e.target.checked)}
            />
            Eş çalışıyor (AGİ azalır)
          </label>
        )}
        <input
          value={iban}
          onChange={(e) => setIban(e.target.value)}
          placeholder="IBAN (opsiyonel)"
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm font-mono sm:col-span-2"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="E-posta"
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Telefon"
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        />
      </div>

      {/* Hesaplama önizleme */}
      <div className="mt-3">
        <button
          onClick={() => preview.mutate()}
          disabled={!gross || preview.isPending}
          className="text-xs border border-brand-200 dark:border-slate-700 hover:bg-brand-50 dark:hover:bg-slate-800 text-brand-700 dark:text-slate-300 px-3 py-1.5 rounded flex items-center gap-1 disabled:opacity-50"
        >
          <Calculator className="size-3" />
          Net Maaş Hesapla
        </button>
        {calc && (
          <div className="mt-2 bg-emerald-50 dark:bg-emerald-900/20 rounded p-3 text-xs">
            <div className="grid sm:grid-cols-2 gap-1 font-mono">
              <span>Brüt: {fmtTRY(calc.gross)}</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                Net: {fmtTRY(calc.net)}
              </span>
              <span>SGK işçi: -{fmtTRY(calc.sgk_employee)}</span>
              <span>İşsizlik işçi: -{fmtTRY(calc.unemployment_employee)}</span>
              <span>Gelir vergisi: -{fmtTRY(calc.income_tax)}</span>
              <span>Damga: -{fmtTRY(calc.stamp_tax)}</span>
              <span>AGİ: +{fmtTRY(calc.agi)}</span>
              <span className="text-amber-700 dark:text-amber-400">
                İşveren maliyeti: {fmtTRY(calc.total_employer_cost)}
              </span>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      <div className="flex justify-end gap-2 mt-3">
        <button
          onClick={onClose}
          className="text-sm text-brand-600 dark:text-slate-400 hover:bg-brand-100 dark:hover:bg-slate-800 px-3 py-2 rounded"
        >
          İptal
        </button>
        <button
          onClick={() => {
            setError(null);
            if (fullName.length < 2) return setError('Ad zorunlu');
            if (!gross) return setError('Brüt maaş zorunlu');
            create.mutate();
          }}
          disabled={create.isPending}
          className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-60"
        >
          {create.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          Kaydet
        </button>
      </div>
    </div>
  );
}
