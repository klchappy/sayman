/**
 * /v1/openapi.json + /v1/docs — OpenAPI 3.0 spec + Swagger UI.
 *
 * Endpoint listesi sade — tüm route'lar (95+) burada listelenmez; en sık kullanılan
 * 3rd-party entegrasyon yüzeyi belgelenir. İhtiyaca göre genişletilir.
 *
 * Auth modeli: Bearer API token (`st_...`) — Security şeması.
 */
import { Router } from 'express';

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Sayman API',
    version: '0.1.0',
    description:
      'Sayman muhasebe operasyon platformu — 3rd-party entegrasyon API. ' +
      'Auth: Bearer API token (Security sayfasından üretilir, `st_...` formatı).',
    contact: { name: 'Sayman', url: 'https://sayman.deploi.net' },
  },
  servers: [
    { url: 'https://api.sayman.deploi.net/v1', description: 'Production' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'API Token (st_...)' },
    },
    schemas: {
      Payable: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          amount: { type: 'string', example: '1234.50' },
          paid_amount: { type: 'string' },
          currency: { type: 'string', example: 'TRY' },
          due_date: { type: 'string', format: 'date', nullable: true },
          status: {
            type: 'string',
            enum: ['draft', 'pending', 'approaching', 'overdue', 'partial_paid', 'paid', 'cancelled', 'archived'],
          },
          supplier_name: { type: 'string', nullable: true },
          invoice_number: { type: 'string', nullable: true },
        },
      },
      Guarantee: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          beneficiary_name: { type: 'string' },
          letter_no: { type: 'string', nullable: true },
          amount: { type: 'string' },
          currency: { type: 'string' },
          issue_date: { type: 'string', format: 'date', nullable: true },
          expiry_date: { type: 'string', format: 'date', nullable: true },
          status: { type: 'string', enum: ['active', 'returned', 'expired', 'cancelled'] },
        },
      },
      Error: {
        type: 'object',
        properties: { error: { type: 'string' }, message: { type: 'string' } },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        security: [],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/me': {
      get: {
        summary: 'Kullanıcı profili + organization üyelikleri',
        responses: { '200': { description: 'User info' } },
      },
    },
    '/payables': {
      get: {
        summary: 'Tenant\'taki tüm fatura/borç kayıtları',
        parameters: [
          { name: 'X-Sayman-Org', in: 'header', required: true, schema: { type: 'string' } },
          { name: 'X-Sayman-Tenant', in: 'header', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Liste',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Payable' } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Yeni fatura',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'amount'],
                properties: {
                  title: { type: 'string' },
                  amount: { type: 'string' },
                  due_date: { type: 'string', format: 'date' },
                  owner_type: { type: 'string', enum: ['company', 'person', 'family', 'other'] },
                  company_id: { type: 'string', format: 'uuid', nullable: true },
                  subsidiary_id: { type: 'string', format: 'uuid', nullable: true },
                  invoice_number: { type: 'string', nullable: true },
                  supplier_name: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Created', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Payable' } } } } } },
        },
      },
    },
    '/guarantees': {
      get: {
        summary: 'Aktif teminat mektupları',
        responses: { '200': { description: 'Liste' } },
      },
      post: { summary: 'Yeni teminat', responses: { '201': { description: 'Created' } } },
    },
    '/subscriptions': {
      get: { summary: 'Abonelikler', responses: { '200': { description: 'Liste' } } },
    },
    '/efatura/import': {
      post: {
        summary: 'e-Fatura UBL XML içe aktar (payable_items\'a yazar)',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['xml'],
                properties: {
                  xml: { type: 'string', description: 'UBL-TR Invoice XML metin' },
                  dry_run: { type: 'boolean', default: false },
                  subsidiary_id: { type: 'string', format: 'uuid', nullable: true },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/efatura/import-zip': {
      post: {
        summary: 'ZIP içindeki tüm UBL XML\'leri toplu içe aktar',
        responses: { '200': { description: 'Sonuç (success/failed)' } },
      },
    },
    '/import/{resource}': {
      post: {
        summary: 'CSV / XLSX / JSON bulk insert',
        parameters: [
          {
            name: 'resource',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              enum: ['persons', 'companies', 'properties', 'payables', 'subscriptions', 'regular-payments', 'guarantees'],
            },
          },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['format', 'data'],
                properties: {
                  format: { type: 'string', enum: ['csv', 'json', 'xlsx'] },
                  data: { type: 'string', description: 'CSV string, xlsx base64, veya JSON array' },
                  dry_run: { type: 'boolean', default: true },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Sonuç' } },
      },
    },
    '/attachments': {
      get: {
        summary: 'Polimorfik dosya ekleri liste',
        parameters: [
          { name: 'related_table', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'related_id', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { '200': { description: 'Liste' } },
      },
      post: {
        summary: 'Dosya yükle (multipart/form-data, field: file)',
        responses: { '201': { description: 'Created' } },
      },
    },
    '/fx-rates/latest': {
      get: { summary: 'TCMB en güncel kurlar', responses: { '200': { description: 'Kurlar' } } },
    },
    '/webhooks': {
      get: { summary: 'Org\'un webhook endpoint listesi', responses: { '200': { description: 'Liste' } } },
      post: { summary: 'Yeni webhook endpoint', responses: { '201': { description: 'Created (secret bir kez döner)' } } },
    },
  },
};

export const openApiRouter = Router();

openApiRouter.get('/openapi.json', (_req, res) => {
  res.json(openApiSpec);
});

openApiRouter.get('/docs', (_req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html>
<head>
<title>Sayman API Dokümantasyonu</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
<div id="swagger"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
window.onload = () => {
  SwaggerUIBundle({
    url: '/v1/openapi.json',
    dom_id: '#swagger',
    deepLinking: true,
    persistAuthorization: true,
  });
};
</script>
</body>
</html>`);
});
