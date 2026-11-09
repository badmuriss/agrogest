import type { SQLiteDatabase } from 'expo-sqlite';

import { buildAllocations, monthlyInstallments, type AllocationTarget } from '@/domain/allocation';
import type {
  AllocationCriterion,
  Entry,
  EntryContent,
  EntryStatus,
  Farm,
  HistoryItem,
  Lot,
  Membership,
  Operation,
  Pasture,
  User,
} from '@/domain/types';
import { SYSTEM_USER } from '@/domain/workflow';

import { insertLot, insertMembership, insertOperation, saveEntry, saveFarm, savePasture, setSetting } from './repo';

/**
 * Dados fictícios de demonstração. Nomes, empresas e valores são ilustrativos.
 * "Ana" é um marcador: ao carregar, vira a pessoa logada, que passa a ser sócia das duas operações.
 */
const ANA = 'u-ana';
const PAULO = 'u-paulo';
const MARCOS = 'u-marcos';
const JOAO = 'u-joao';
const RECRIA = 'op-recria';
const BOAVISTA = 'op-boavista';
const SANTA_RITA = 'farm-santa-rita';
const BOA_VISTA = 'farm-boa-vista';

const users: User[] = [
  { id: PAULO, name: 'Paulo Lima', email: null },
  { id: MARCOS, name: 'Marcos Reis', email: null },
  { id: JOAO, name: 'João Pereira', email: null },
];

const operations: Operation[] = [
  { id: RECRIA, name: 'Parceria Recria 2026' },
  { id: BOAVISTA, name: 'Engorda Boa Vista' },
];

const memberships: Membership[] = [
  { operationId: RECRIA, userId: ANA, role: 'socio', sharePct: 50 },
  { operationId: RECRIA, userId: PAULO, role: 'socio', sharePct: 50 },
  { operationId: RECRIA, userId: JOAO, role: 'funcionario', sharePct: null },
  { operationId: BOAVISTA, userId: ANA, role: 'socio', sharePct: 60 },
  { operationId: BOAVISTA, userId: MARCOS, role: 'socio', sharePct: 40 },
  { operationId: BOAVISTA, userId: JOAO, role: 'funcionario', sharePct: null },
];

const farms: Farm[] = [
  { id: SANTA_RITA, name: 'Fazenda Santa Rita', operationId: RECRIA, pastureRentCents: 5_000, city: 'Uberaba, MG' },
  { id: BOA_VISTA, name: 'Fazenda Boa Vista', operationId: BOAVISTA, pastureRentCents: 4_500, city: 'Araguaína, TO' },
];

const CORREGO = 'pasture-corrego';
const PIQUETE = 'pasture-piquete-3';
const REPRESA = 'pasture-represa';
const GRANDE = 'pasture-grande';

const pastures: Pasture[] = [
  { id: CORREGO, operationId: RECRIA, farmId: SANTA_RITA, name: 'Pasto do Córrego', areaHa: 32, forage: 'Brachiaria (Marandu)', notes: '', active: true, createdAt: '2026-03-01T12:00:00.000Z' },
  { id: PIQUETE, operationId: RECRIA, farmId: SANTA_RITA, name: 'Piquete 3', areaHa: 12, forage: 'Mombaça', notes: 'Piquete rotacionado', active: true, createdAt: '2026-03-01T12:00:00.000Z' },
  { id: REPRESA, operationId: RECRIA, farmId: SANTA_RITA, name: 'Pasto da Represa', areaHa: 25, forage: 'Brachiaria (Marandu)', notes: '', active: true, createdAt: '2026-03-01T12:00:00.000Z' },
  { id: GRANDE, operationId: BOAVISTA, farmId: BOA_VISTA, name: 'Pasto Grande', areaHa: 60, forage: 'Tanzânia', notes: '', active: true, createdAt: '2026-05-01T12:00:00.000Z' },
];

const lots: Lot[] = [
  {
    id: 'lot-021',
    code: '021',
    operationId: RECRIA,
    farmId: SANTA_RITA,
    managementGroup: 'Pasto do Córrego',
    pastureId: CORREGO,
    supplier: 'Agropecuária Vale Verde',
    category: 'Novilhas',
    purchasedAt: '2026-04-10',
    headsPurchased: 40,
    entryWeightKg: 220,
    purchaseCents: 11_600_000,
    commissionCents: 232_000,
    freightCents: 180_000,
  },
  {
    id: 'lot-022',
    code: '022',
    operationId: RECRIA,
    farmId: SANTA_RITA,
    managementGroup: 'Pasto do Córrego',
    pastureId: CORREGO,
    supplier: 'Fazenda Três Irmãos',
    category: 'Novilhas',
    purchasedAt: '2026-04-18',
    headsPurchased: 40,
    entryWeightKg: 190,
    purchaseCents: 10_400_000,
    commissionCents: 208_000,
    freightCents: 160_000,
  },
  {
    id: 'lot-023',
    code: '023',
    operationId: RECRIA,
    farmId: SANTA_RITA,
    managementGroup: 'Piquete 3',
    pastureId: PIQUETE,
    supplier: 'Sítio Boa Esperança',
    category: 'Novilhas',
    purchasedAt: '2026-03-02',
    headsPurchased: 40,
    entryWeightKg: 205,
    purchaseCents: 11_000_000,
    commissionCents: 220_000,
    freightCents: 170_000,
  },
  {
    id: 'lot-031',
    code: '031',
    operationId: BOAVISTA,
    farmId: BOA_VISTA,
    managementGroup: 'Pasto Grande',
    pastureId: GRANDE,
    supplier: 'Agropecuária Serra Azul',
    category: 'Novilhas',
    purchasedAt: '2026-05-20',
    headsPurchased: 30,
    entryWeightKg: 280,
    purchaseCents: 9_600_000,
    commissionCents: 192_000,
    freightCents: 150_000,
  },
];

interface SeedSpec {
  id: string;
  operationId: string;
  farmId: string;
  authorId: string;
  title: string;
  amountCents: number | null;
  occurredAt: string;
  status: EntryStatus;
  decidedBy?: string;
  decisionNote?: string;
  conflictReason?: string;
  content: EntryContent;
}

function seedEntry(spec: SeedSpec): Entry {
  const createdAt = `${spec.occurredAt}T12:00:00.000Z`;
  const decidedAt = spec.decidedBy ? `${spec.occurredAt}T20:00:00.000Z` : null;
  const history: HistoryItem[] = [{ at: createdAt, by: spec.authorId, action: 'criado' }];
  if (spec.status !== 'rascunho' && spec.status !== 'aguardando_envio') {
    history.push({ at: createdAt, by: spec.authorId, action: 'enviado' });
  }
  if (spec.status === 'aprovado' && spec.decidedBy && decidedAt) {
    history.push({ at: decidedAt, by: spec.decidedBy, action: 'aprovado' });
  }
  if (spec.status === 'rejeitado' && spec.decidedBy && decidedAt) {
    history.push({ at: decidedAt, by: spec.decidedBy, action: 'recusado', note: spec.decisionNote });
  }
  if (spec.status === 'conflito') {
    history.push({ at: createdAt, by: SYSTEM_USER, action: 'conflito', note: spec.conflictReason });
  }
  return {
    id: spec.id,
    status: spec.status,
    operationId: spec.operationId,
    farmId: spec.farmId,
    authorId: spec.authorId,
    title: spec.title,
    amountCents: spec.amountCents,
    occurredAt: spec.occurredAt,
    createdAt,
    decidedBy: spec.decidedBy ?? null,
    decidedAt,
    decisionNote: spec.decisionNote ?? null,
    pendingDecision: null,
    pendingDecisionBy: null,
    pendingDecisionNote: null,
    conflictReason: spec.conflictReason ?? null,
    history,
    ...spec.content,
  };
}

function expense(
  spec: Omit<SeedSpec, 'content' | 'amountCents'> & {
    amountCents: number;
    category: string;
    supplier: string;
    installments?: number;
    criterion: AllocationCriterion;
    targets: AllocationTarget[];
  },
): Entry {
  const { allocations } = buildAllocations(spec.amountCents, spec.criterion, spec.targets, {});
  return seedEntry({
    ...spec,
    content: {
      kind: 'despesa',
      payload: {
        category: spec.category,
        description: spec.title,
        supplier: spec.supplier,
        document: '',
        installments: monthlyInstallments(spec.amountCents, spec.installments ?? 1, spec.occurredAt),
        criterion: spec.criterion,
        allocations,
      },
    },
  });
}

function weighing(
  id: string,
  lotId: string,
  occurredAt: string,
  method: 'medido' | 'estimado',
  avgWeightKg: number,
  headsWeighed: number,
  authorId: string,
  status: EntryStatus,
  decidedBy?: string,
): Entry {
  const lot = lots.find((l) => l.id === lotId)!;
  return seedEntry({
    id,
    operationId: lot.operationId,
    farmId: lot.farmId,
    authorId,
    title: `${method === 'medido' ? 'Pesagem' : 'Estimativa de peso'} — Origem ${lot.code}`,
    amountCents: null,
    occurredAt,
    status,
    decidedBy,
    content: { kind: 'pesagem', payload: { lotId, method, avgWeightKg, headsWeighed, notes: '' } },
  });
}

function move(
  id: string,
  lotId: string,
  occurredAt: string,
  fromPastureId: string,
  toPastureId: string,
  heads: number,
  authorId: string,
  status: EntryStatus,
  decidedBy?: string,
): Entry {
  const lot = lots.find((l) => l.id === lotId)!;
  const name = (pastureId: string) => pastures.find((p) => p.id === pastureId)!.name;
  const entry = seedEntry({
    id,
    operationId: lot.operationId,
    farmId: lot.farmId,
    authorId,
    title: `${name(fromPastureId)} → ${name(toPastureId)} — Origem ${lot.code}`,
    amountCents: null,
    occurredAt,
    status,
    decidedBy,
    content: { kind: 'manejo', payload: { lotId, fromPastureId, toPastureId, heads, notes: '' } },
  });
  // Registrada depois da pesagem do mesmo dia: o peso abre a permanência no novo pasto.
  return { ...entry, createdAt: `${occurredAt}T13:00:00.000Z` };
}

const entries: Entry[] = [
  move('e-man-021-jul', 'lot-021', '2026-07-15', CORREGO, REPRESA, 40, JOAO, 'aprovado', ANA),
  move('e-man-023-set', 'lot-023', '2026-09-12', PIQUETE, REPRESA, 15, JOAO, 'aprovado', PAULO),
  move('e-man-022-out', 'lot-022', '2026-10-12', CORREGO, PIQUETE, 10, JOAO, 'aguardando_aprovacao'),
  weighing('e-pes-023-jun', 'lot-023', '2026-06-10', 'medido', 290, 40, JOAO, 'aprovado', PAULO),
  weighing('e-pes-021-jul', 'lot-021', '2026-07-15', 'medido', 268, 40, JOAO, 'aprovado', ANA),
  weighing('e-pes-022-jul', 'lot-022', '2026-07-15', 'medido', 236, 40, JOAO, 'aprovado', ANA),
  weighing('e-pes-031-ago', 'lot-031', '2026-08-28', 'medido', 352, 30, JOAO, 'aprovado', ANA),
  weighing('e-pes-023-set', 'lot-023', '2026-09-10', 'estimado', 360, 40, PAULO, 'aprovado', ANA),
  weighing('e-pes-021-set', 'lot-021', '2026-09-20', 'estimado', 300, 40, JOAO, 'aprovado', PAULO),
  expense({
    id: 'e-desp-vacina',
    operationId: RECRIA,
    farmId: SANTA_RITA,
    authorId: JOAO,
    title: 'Vacinação e vermífugo',
    amountCents: 240_000,
    occurredAt: '2026-05-05',
    status: 'aprovado',
    decidedBy: PAULO,
    category: 'Medicamentos e vacinas',
    supplier: 'Casa do Criador',
    criterion: 'cabeca',
    targets: [
      { lotId: 'lot-021', heads: 40, avgWeightKg: 220 },
      { lotId: 'lot-022', heads: 40, avgWeightKg: 190 },
      { lotId: 'lot-023', heads: 40, avgWeightKg: 205 },
    ],
  }),
  expense({
    id: 'e-desp-cerca-bv',
    operationId: BOAVISTA,
    farmId: BOA_VISTA,
    authorId: MARCOS,
    title: 'Reforma de cerca — Pasto Grande',
    amountCents: 480_000,
    occurredAt: '2026-07-12',
    status: 'aprovado',
    decidedBy: ANA,
    category: 'Manutenção de cercas',
    supplier: 'Cercas Rio Claro',
    installments: 2,
    criterion: 'cabeca',
    targets: [{ lotId: 'lot-031', heads: 30, avgWeightKg: 280 }],
  }),
  expense({
    id: 'e-desp-sal',
    operationId: RECRIA,
    farmId: SANTA_RITA,
    authorId: ANA,
    title: 'Sal mineral — agosto',
    amountCents: 360_000,
    occurredAt: '2026-08-05',
    status: 'aprovado',
    decidedBy: PAULO,
    category: 'Alimentação e insumos',
    supplier: 'Casa do Criador',
    criterion: 'peso',
    targets: [
      { lotId: 'lot-021', heads: 40, avgWeightKg: 268 },
      { lotId: 'lot-022', heads: 40, avgWeightKg: 236 },
      { lotId: 'lot-023', heads: 40, avgWeightKg: 290 },
    ],
  }),
  expense({
    id: 'e-desp-proteinado',
    operationId: RECRIA,
    farmId: SANTA_RITA,
    authorId: JOAO,
    title: 'Proteinado — setembro',
    amountCents: 1_000_000,
    occurredAt: '2026-09-01',
    status: 'aprovado',
    decidedBy: ANA,
    category: 'Alimentação e insumos',
    supplier: 'Casa do Criador',
    installments: 3,
    criterion: 'cabeca',
    targets: [
      { lotId: 'lot-021', heads: 40, avgWeightKg: 268 },
      { lotId: 'lot-022', heads: 40, avgWeightKg: 236 },
    ],
  }),
  seedEntry({
    id: 'e-venda-023',
    operationId: RECRIA,
    farmId: SANTA_RITA,
    authorId: ANA,
    title: 'Venda de 12 cabeças — Origem 023',
    amountCents: 5_120_000,
    occurredAt: '2026-09-25',
    status: 'aprovado',
    decidedBy: PAULO,
    content: {
      kind: 'venda',
      payload: {
        lotId: 'lot-023',
        buyer: 'Frigorífico Vale do Rio',
        heads: 12,
        carcassKg: 2_400,
        pricePerArrobaCents: 32_000,
        deductionsCents: 120_000,
        pastureId: PIQUETE,
      },
    },
  }),
  seedEntry({
    id: 'e-mort-022',
    operationId: RECRIA,
    farmId: SANTA_RITA,
    authorId: JOAO,
    title: 'Mortalidade — Origem 022',
    amountCents: null,
    occurredAt: '2026-09-28',
    status: 'aprovado',
    decidedBy: PAULO,
    content: {
      kind: 'mortalidade',
      payload: { lotId: 'lot-022', heads: 1, cause: 'Tristeza parasitária', notes: '' },
    },
  }),
  expense({
    id: 'e-desp-comb',
    operationId: RECRIA,
    farmId: SANTA_RITA,
    authorId: ANA,
    title: 'Combustível — roçadeira',
    amountCents: 68_000,
    occurredAt: '2026-10-02',
    status: 'rejeitado',
    decidedBy: PAULO,
    decisionNote: 'O valor está diferente do cupom. Corrija e envie de novo.',
    category: 'Combustível',
    supplier: 'Posto Estrada Real',
    criterion: 'cabeca',
    targets: [],
  }),
  expense({
    id: 'e-desp-vet',
    operationId: RECRIA,
    farmId: SANTA_RITA,
    authorId: ANA,
    title: 'Visita veterinária',
    amountCents: 185_000,
    occurredAt: '2026-10-09',
    status: 'aguardando_aprovacao',
    category: 'Medicamentos e vacinas',
    supplier: 'Clínica Veterinária Campo Bom',
    criterion: 'cabeca',
    targets: [{ lotId: 'lot-023', heads: 28, avgWeightKg: 360 }],
  }),
  expense({
    id: 'e-desp-racao-bv',
    operationId: BOAVISTA,
    farmId: BOA_VISTA,
    authorId: MARCOS,
    title: 'Ração de cocho',
    amountCents: 630_000,
    occurredAt: '2026-10-10',
    status: 'aguardando_aprovacao',
    category: 'Alimentação e insumos',
    supplier: 'Nutrimix Rações',
    installments: 2,
    criterion: 'cabeca',
    targets: [{ lotId: 'lot-031', heads: 30, avgWeightKg: 352 }],
  }),
  expense({
    id: 'e-desp-cerca-sr',
    operationId: RECRIA,
    farmId: SANTA_RITA,
    authorId: JOAO,
    title: 'Manutenção de cerca — Pasto do Córrego',
    amountCents: 240_000,
    occurredAt: '2026-10-11',
    status: 'aguardando_aprovacao',
    category: 'Manutenção de cercas',
    supplier: 'Cercas Rio Claro',
    criterion: 'cabeca',
    targets: [
      { lotId: 'lot-021', heads: 40, avgWeightKg: 300 },
      { lotId: 'lot-022', heads: 39, avgWeightKg: 236 },
    ],
  }),
  seedEntry({
    id: 'e-mort-021',
    operationId: RECRIA,
    farmId: SANTA_RITA,
    authorId: JOAO,
    title: 'Mortalidade — Origem 021',
    amountCents: null,
    occurredAt: '2026-10-12',
    status: 'aguardando_aprovacao',
    content: {
      kind: 'mortalidade',
      payload: { lotId: 'lot-021', heads: 1, cause: 'Causa desconhecida', notes: 'Encontrada no fundo do pasto.' },
    },
  }),
  seedEntry({
    id: 'e-venda-023-conflito',
    operationId: RECRIA,
    farmId: SANTA_RITA,
    authorId: ANA,
    title: 'Venda de 30 cabeças — Origem 023',
    amountCents: 13_650_000,
    occurredAt: '2026-10-12',
    status: 'conflito',
    conflictReason:
      'O lote tem 28 cabeças confirmadas, mas esta venda pede 30. Outro celular pode ter registrado uma baixa antes.',
    content: {
      kind: 'venda',
      payload: {
        lotId: 'lot-023',
        buyer: 'Frigorífico Vale do Rio',
        heads: 30,
        carcassKg: 6_300,
        pricePerArrobaCents: 32_500,
        deductionsCents: 300_000,
      },
    },
  }),
  weighing('e-pes-021-out', 'lot-021', '2026-10-13', 'estimado', 305, 40, ANA, 'aguardando_envio'),
  seedEntry({
    id: 'e-nf-offline',
    operationId: RECRIA,
    farmId: SANTA_RITA,
    authorId: ANA,
    title: 'Nota fiscal capturada',
    amountCents: null,
    occurredAt: '2026-10-13',
    status: 'aguardando_envio',
    content: {
      kind: 'nota_fiscal',
      payload: {
        stage: 'aguardando_conexao',
        fileName: 'nota-casa-do-criador.jpg',
        fileKind: 'imagem',
        extraction: null,
        edited: [],
        destination: 'estoque',
        installments: [],
        criterion: 'cabeca',
        allocations: [],
      },
    },
  }),
];

export const SAMPLE_OPERATION_IDS = [RECRIA, BOAVISTA];

const sampleSettings: Record<string, string> = {
  contextFarmId: SANTA_RITA,
  // O cenário começa sem internet para mostrar a fila e a nota esperando conexão.
  online: '0',
  lastSyncAt: '2026-10-14T11:30:00.000Z',
  [`mode:${PAULO}`]: 'analitico',
  [`mode:${MARCOS}`]: 'gerencial',
  [`mode:${JOAO}`]: 'essencial',
};

/** Carrega o cenário de exemplo ao lado do que a pessoa já cadastrou. */
export async function loadSampleData(db: SQLiteDatabase, meId: string): Promise<void> {
  const me = (id: string) => (id === ANA ? meId : id);
  await db.withTransactionAsync(async () => {
    for (const u of users) await db.runAsync('INSERT OR IGNORE INTO users (id, name, email) VALUES (?, ?, ?)', [u.id, u.name, u.email]);
    for (const o of operations) await insertOperation(db, { ...o, ownerId: meId });
    for (const m of memberships) await insertMembership(db, { ...m, userId: me(m.userId) });
    for (const f of farms) await saveFarm(db, f);
    for (const p of pastures) await savePasture(db, p);
    for (const l of lots) await insertLot(db, l);
    for (const e of entries) {
      await saveEntry(db, {
        ...e,
        authorId: me(e.authorId),
        decidedBy: e.decidedBy ? me(e.decidedBy) : null,
        history: e.history.map((h) => ({ ...h, by: me(h.by) })),
      });
    }
    for (const [key, value] of Object.entries(sampleSettings)) await setSetting(db, key, value);
  });
}

/** Remove só o cenário de exemplo; fazendas e lançamentos da pessoa ficam. */
export async function removeSampleData(db: SQLiteDatabase): Promise<void> {
  const ops = SAMPLE_OPERATION_IDS.map(() => '?').join(', ');
  await db.withTransactionAsync(async () => {
    for (const table of ['entries', 'lots', 'pastures', 'farms', 'memberships', 'invites']) {
      await db.runAsync(`DELETE FROM ${table} WHERE operation_id IN (${ops})`, SAMPLE_OPERATION_IDS);
    }
    await db.runAsync(`DELETE FROM operations WHERE id IN (${ops})`, SAMPLE_OPERATION_IDS);
    await db.runAsync(
      `DELETE FROM users WHERE id IN (${users.map(() => '?').join(', ')})
         AND id NOT IN (SELECT user_id FROM memberships)`,
      users.map((u) => u.id),
    );
  });
}
