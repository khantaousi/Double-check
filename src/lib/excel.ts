import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { DataRow } from '../types';
import { formatBST } from './utils';

export async function generateStyledExcel(data: DataRow[]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Validated Orders');

  // Define columns
  worksheet.columns = [
    { header: 'ItemType', key: 'ItemType', width: 15 },
    { header: 'StoreName', key: 'StoreName', width: 15 },
    { header: 'MerchantOrderId', key: 'MerchantOrderId', width: 20 },
    { header: 'RecipientName(*)', key: 'RecipientName', width: 20 },
    { header: 'RecipientPhone(*)', key: 'RecipientPhone', width: 20 },
    { header: 'RecipientAddress(*)', key: 'RecipientAddress', width: 30 },
    { header: 'RecipientCity(*)', key: 'RecipientCity', width: 15 },
    { header: 'RecipientZone(*)', key: 'RecipientZone', width: 15 },
    { header: 'RecipientArea', key: 'RecipientArea', width: 15 },
    { header: 'AmountToCollect(*)', key: 'AmountToCollect', width: 18 },
    { header: 'CalculatedTotal', key: 'calculatedTotal', width: 18 },
    { header: 'ItemQuantity', key: 'ItemQuantity', width: 12 },
    { header: 'ItemWeight', key: 'ItemWeight', width: 12 },
    { header: 'ItemDesc', key: 'ItemDesc', width: 30 },
    { header: 'SpecialInstruction', key: 'SpecialInstruction', width: 30 },
    { header: 'Notes', key: 'notes', width: 40 },
  ];

  // Header styling
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  // Add data and style rows
  data.forEach(row => {
    const excelRow = worksheet.addRow({
      ...row,
      notes: row.notes?.join(', ') || ''
    });

    if (row.isMismatch || row.isDuplicate) {
      excelRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFCCCC' } // Soft Red
      };
    } else if (row.isPermitted) {
      excelRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE1BEE7' } // Light Purple
      };
    } else {
      excelRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8F5E9' } // Soft Green (matching emerald-50/30 vibe)
      };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Validation_Report_${formatBST(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

export async function generateRankingsExcel(data: any[]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Team Rankings');

  // Define columns
  worksheet.columns = [
    { header: 'Rank', key: 'rank', width: 8 },
    { header: 'Staff Name', key: 'name', width: 25 },
    { header: 'Work History (Protocol & Timestamp)', key: 'workHistory', width: 60 },
    { header: 'Completed', key: 'completed', width: 12 },
    { header: 'Total Pause (m)', key: 'totalPause', width: 15 },
    { header: 'Avg Time (m)', key: 'avgMinutes', width: 15 },
  ];

  // Header styling
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2563EB' } // matching blue-600
  };

  // Add data
  data.forEach((item, index) => {
    const workHistory = item.completedTasks?.map((t: any) => `- ${t.title} [${t.date}]`).join('\n') || '';
    
    const row = worksheet.addRow({
      rank: index + 1,
      name: item.name,
      workHistory: workHistory,
      completed: item.completed,
      totalPause: item.totalPause,
      avgMinutes: item.avgMinutes
    });

    // Enable text wrapping for work history and alignment
    row.getCell('workHistory').alignment = { wrapText: true, vertical: 'top' };
    row.alignment = { vertical: 'top' };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Team_Rankings_${formatBST(new Date(), 'yyyy-MM-dd')}.xlsx`);
}
