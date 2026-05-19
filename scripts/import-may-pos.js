// One-time import: MAY-01 to MAY-09 POs + outlet allocations from Excel
const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');

const prisma = new PrismaClient();
const EXCEL = '/Users/gwenheng/Downloads/MAY 26 NEW STOCK (SHOES).xlsx';
const ADMIN_ID = 'cmowc42xe0000ifwitvyj8zlx';

const MANUFACTURER_MAP = {
  'NANCY':    'cmowc42xt0006ifwihde3z76y',
  'ANNA':     'cmowc42xq0002ifwib3l0hgvr',
  'MS SWEET': 'cmowc42xt0005ifwi05sw6iv2',
  'TINA':     'cmowc42xv0008ifwi2vmzd43j', // Tina Bella
  'SOPHIA':   'cmowc42xu0007ifwiv3knvvaw',
};

const OUTLET_MAP = {
  'JN53-H2UWM':    'cmowg9eed0001nkbf2y1yx9d7',
  'JN55-H2UES':    'cmowg9eee0002nkbfe9eiqekp',
  'JN55-H2USA':    'cmowg9eef0003nkbfrwixoa72',
  'JN59-H2UMV':    'cmowg9eef0004nkbfwbxvom6o',
  'JN62-H2UPTJ':   'cmowg9eeg0005nkbflnslo9rr',
  'JN75-H2UABM':   'cmowg9eeg0006nkbf86bo15ax',
  'JN75-H2UABMDEP':'cmowg9eeh0007nkbfyai2gkfq',
  'JN75-H2UAK':    'cmowg9eei0008nkbfkahlsmcb',
  'JN75-H2UHQ':    'cmowg9eei0009nkbfhtoz6o1y',
  'JN81-H2UATC':   'cmowg9eej000ankbfoo8xwf0z',
  'JN81-H2UBI':    'cmowg9eej000bnkbf9yec4sdi',
};

function excelDate(v) {
  if (!v || typeof v !== 'number') return null;
  return new Date(Math.round((v - 25569) * 86400000));
}

function str(v) { return String(v || '').trim(); }

// Parse PL sheet → { h2uSku: [ {outletId, qty36..41} ] }
function parsePL(wb, plSheet) {
  const ws = wb.Sheets[plSheet];
  if (!ws) return {};
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const map = {};
  let currentSku = '';
  for (let i = 16; i < rows.length; i++) {
    const r = rows[i];
    const sku = str(r[2]);
    const marking = str(r[4]);
    if (sku) currentSku = sku;
    if (!currentSku || !marking || marking === 'MARKING') continue;
    const outletId = OUTLET_MAP[marking];
    if (!outletId) continue; // skip unknown markings (e.g. TH-BFZPV-A)
    const q = [r[5],r[6],r[7],r[8],r[9],r[10]].map(v => Number(v)||0);
    const total = q.reduce((a,b)=>a+b,0);
    if (total === 0) continue;
    if (!map[currentSku]) map[currentSku] = [];
    map[currentSku].push({
      outletId,
      qty36:q[0], qty37:q[1], qty38:q[2], qty39:q[3], qty40:q[4], qty41:q[5],
    });
  }
  return map;
}

// Parse PO sheet → { header, items }
function parsePO(wb, poSheet) {
  const ws = wb.Sheets[poSheet];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const date = excelDate(rows[1]?.[23]);
  const totalPairs = Number(rows[2]?.[23]) || 0;
  const totalPrice = Number(rows[3]?.[23]) || 0;

  const items = [];
  for (let i = 7; i < rows.length; i++) {
    const r = rows[i];
    const h2uSku = str(r[3]);
    if (!h2uSku || h2uSku === 'H2U SKU') continue;
    const pairs = Number(r[21]) || 0;
    if (!pairs) continue;
    items.push({
      supplierSku:     str(r[0]) || null,
      h2uSku,
      colorName:       str(r[4]) || null,
      colorCode:       str(r[5]) || null,
      materialUpper:   str(r[6]) || null,
      materialLining:  str(r[7]) || null,
      materialMidsole: str(r[8]) || null,
      materialOutsole: str(r[9]) || null,
      hardware:        str(r[10]) || null,
      remark:          str(r[11]) || null,
      logoSpec:        str(r[12]) || null,
      deliveryDate:    excelDate(r[13]),
      qty35: 0,
      qty36: Number(r[14])||0,
      qty37: Number(r[15])||0,
      qty38: Number(r[16])||0,
      qty39: Number(r[17])||0,
      qty40: Number(r[18])||0,
      qty41: Number(r[19])||0,
      qty42: 0,
      totalPairs: pairs,
      discountPrice:   Number(r[22]) || null,
      lineTotal:       Number(r[23]) || 0,
    });
  }
  return { date, totalPairs, totalPrice, items };
}

const PO_CONFIGS = [
  { poNo:'MAY-01', mfr:'NANCY',       poSheet:'MAY-01 (NANCY)',       plSheet:'MAY-01 (PL)'  },
  { poNo:'MAY-02', mfr:'ANNA',        poSheet:'MAY-02 (ANNA)',        plSheet:'MAY-02 (PL)'  },
  { poNo:'MAY-03', mfr:'ZHANG SHENG', poSheet:'MAY-03 (ZHANG SHENG)', plSheet:'MAY-03 (PL)'  },
  { poNo:'MAY-04', mfr:'MS SWEET',    poSheet:'MAY-04 (MS SWEET)',    plSheet:'MAY-04 (PL)'  },
  { poNo:'MAY-05', mfr:'TINA',        poSheet:'MAY-05 (TINA)',        plSheet:'MAY-05 (PL)'  },
  { poNo:'MAY-06', mfr:'JOJO',        poSheet:'MAY-06 (JOJO)',        plSheet:'MAY-06 (PL)'  },
  { poNo:'MAY-07', mfr:'SOPHIA',      poSheet:'MAY-07 (SOPHIA)',      plSheet:'MAY-07 (PL)'  },
  { poNo:'MAY-08', mfr:'NANCY',       poSheet:'MAY-08 (NANCY)',       plSheet:'MAY-08 (PL) ' },
  { poNo:'MAY-09', mfr:'MS SWEET',    poSheet:'MAY-09 (MS SWEET)',    plSheet:'MAY-09 (PL)'  },
];

async function main() {
  const wb = XLSX.readFile(EXCEL);

  // Create missing manufacturers
  for (const name of ['Zhang Sheng', 'Jojo']) {
    const key = name.toUpperCase().replace(' ', ' ');
    const exists = await prisma.manufacturer.findFirst({ where: { name: { equals: name } } });
    if (!exists) {
      const m = await prisma.manufacturer.create({ data: { name } });
      MANUFACTURER_MAP[name.toUpperCase()] = m.id;
      console.log('Created manufacturer:', name, m.id);
    } else {
      MANUFACTURER_MAP[name.toUpperCase()] = exists.id;
      console.log('Found manufacturer:', name, exists.id);
    }
  }
  // Fix key for ZHANG SHENG
  if (!MANUFACTURER_MAP['ZHANG SHENG'] && MANUFACTURER_MAP['ZHANG SHENG']) {}
  const zhangId = MANUFACTURER_MAP['ZHANG SHENG'] || (await prisma.manufacturer.findFirst({ where: { name: 'Zhang Sheng' } }))?.id;
  MANUFACTURER_MAP['ZHANG SHENG'] = zhangId;
  const jojoId = MANUFACTURER_MAP['JOJO'] || (await prisma.manufacturer.findFirst({ where: { name: 'Jojo' } }))?.id;
  MANUFACTURER_MAP['JOJO'] = jojoId;

  for (const cfg of PO_CONFIGS) {
    // Skip if already exists
    const existing = await prisma.purchaseOrder.findFirst({ where: { poNumber: cfg.poNo } });
    if (existing) {
      console.log(`SKIP ${cfg.poNo} — already exists (id: ${existing.id})`);
      continue;
    }

    const mfrId = MANUFACTURER_MAP[cfg.mfr];
    if (!mfrId) { console.error('No manufacturer ID for', cfg.mfr); continue; }

    const { date, totalPairs, totalPrice, items } = parsePO(wb, cfg.poSheet);
    const allocMap = parsePL(wb, cfg.plSheet);

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber:       cfg.poNo,
        date:           date ?? new Date('2026-05-12'),
        manufacturerId: mfrId,
        createdById:    ADMIN_ID,
        status:         'draft',
        currency:       'RMB',
        totalPairs,
        totalPrice,
        items: {
          create: items.map(item => ({
            supplierSku:     item.supplierSku,
            h2uSku:          item.h2uSku,
            colorName:       item.colorName,
            colorCode:       item.colorCode,
            materialUpper:   item.materialUpper,
            materialLining:  item.materialLining,
            materialMidsole: item.materialMidsole,
            materialOutsole: item.materialOutsole,
            hardware:        item.hardware,
            remark:          item.remark,
            logoSpec:        item.logoSpec,
            deliveryDate:    item.deliveryDate,
            qty35: item.qty35, qty36: item.qty36, qty37: item.qty37,
            qty38: item.qty38, qty39: item.qty39, qty40: item.qty40,
            qty41: item.qty41, qty42: item.qty42,
            totalPairs:    item.totalPairs,
            discountPrice: item.discountPrice,
            lineTotal:     item.lineTotal,
            outletAllocations: allocMap[item.h2uSku]
              ? JSON.stringify(allocMap[item.h2uSku])
              : null,
          }))
        }
      }
    });

    console.log(`✓ Created ${cfg.poNo} (${cfg.mfr}) — ${items.length} SKUs, ${totalPairs} pairs, RMB ${totalPrice} [id: ${po.id}]`);
  }

  console.log('\nDone!');
}

main().catch(err => { console.error(err); process.exit(1); }).finally(() => prisma.$disconnect());
