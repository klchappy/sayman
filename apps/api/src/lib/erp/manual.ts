/**
 * Manuel CSV adapter — API'si olmayan ERP'ler için.
 *
 * Kullanıcı kendi muhasebe yazılımından ".csv" export edip
 * /v1/erp/connections/:id/upload-csv endpoint'ine yükler. Bu adapter
 * sadece testConnection() OK döner, asıl import endpoint tarafında yapılır.
 *
 * Config yok — sadece "etiketsel" bir bağlantı.
 */
import type {
  AdapterConfig,
  ErpAdapter,
  NormalizedCariAccount,
  NormalizedCariMovement,
  TestResult,
} from './types';

export const manualAdapter: ErpAdapter = {
  provider: 'manual',
  label: 'Manuel CSV / Excel',
  configFields: [
    {
      key: 'source_label',
      label: 'Kaynak Yazılım',
      type: 'text',
      required: false,
      placeholder: 'Mikro Cari Export, Eta Excel, vs.',
      help: 'Sadece etiket — UI\'de görünür',
    },
  ],

  async testConnection(): Promise<TestResult> {
    return {
      ok: true,
      message:
        'Manuel bağlantı hazır. Cari listesi/ekstre CSV\'sini /erp/upload sayfasından yükle.',
    };
  },

  async syncCariAccounts(_config: AdapterConfig): Promise<NormalizedCariAccount[]> {
    // Manuel mode'da sync no-op; veri CSV upload endpoint'inden gelir.
    return [];
  },

  async syncCariMovements(): Promise<NormalizedCariMovement[]> {
    return [];
  },
};
