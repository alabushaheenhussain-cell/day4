import ExcelJS from 'exceljs';

const COLUMNS = [
  { header: 'ID', key: 'id', min: 6 },
  { header: 'Name', key: 'name', min: 14 },
  { header: 'Email', key: 'email', min: 18 },
  { header: 'Phone', key: 'phone', min: 14 },
  { header: 'Address', key: 'address', min: 20 },
  { header: 'Created', key: 'created_at', min: 20 },
];

// Customer values are always written as plain strings (never { formula }), so text such as
// "=HYPERLINK(...)" or "+1-555-0100" is stored as text and cannot run when the file is opened.
const text = (v) => (v == null ? '' : String(v));

export async function customersToXlsx(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Customers', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = COLUMNS.map(({ header, key }) => ({ header, key }));
  ws.getRow(1).font = { bold: true };

  for (const c of rows) {
    const row = ws.addRow({
      id: c.id, name: text(c.name), email: text(c.email), phone: text(c.phone),
      address: text(c.address), created_at: c.created_at ? new Date(c.created_at) : null,
    });
    for (const key of ['name', 'email', 'phone', 'address']) row.getCell(key).numFmt = '@';
    row.getCell('created_at').numFmt = 'yyyy-mm-dd hh:mm';
  }

  COLUMNS.forEach(({ key, min }, i) => {
    const longest = Math.max(...ws.getColumn(key).values.slice(1).map((v) => text(v instanceof Date ? 'yyyy-mm-dd hh:mm' : v).length), 0);
    ws.getColumn(i + 1).width = Math.min(Math.max(longest + 2, min), 60);
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
