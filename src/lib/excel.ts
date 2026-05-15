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
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Staff Name', key: 'name', width: 25 },
    { header: 'Protocol Name', key: 'title', width: 35 },
    { header: 'Start Time', key: 'startedAt', width: 15 },
    { header: 'End Time', key: 'completedAt', width: 15 },
    { header: 'Work Duration (m)', key: 'duration', width: 18 },
    { header: 'Daily Total Pause (m)', key: 'totalPause', width: 22 },
    { header: 'Daily Avg Time (m)', key: 'avgMinutes', width: 20 },
  ];

  // Header styling
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2563EB' } // matching blue-600
  };

  // Add data rows - one row per completed task
  data.forEach((item) => {
    if (item.completedTasks && item.completedTasks.length > 0) {
      item.completedTasks.forEach((task: any) => {
        const row = worksheet.addRow({
          date: item.date,
          name: item.name,
          title: task.title,
          startedAt: task.startedAt,
          completedAt: task.completedAt,
          duration: task.duration,
          totalPause: item.totalPause,
          avgMinutes: item.avgMinutes
        });
        row.alignment = { vertical: 'middle', horizontal: 'left' };
      });
    } else {
      // Fallback for an item with no tasks (though analytics filters these out)
      const row = worksheet.addRow({
        date: item.date,
        name: item.name,
        totalPause: item.totalPause,
        avgMinutes: item.avgMinutes
      });
      row.alignment = { vertical: 'middle', horizontal: 'left' };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Team_Performance_Report_${formatBST(new Date(), 'yyyy-MM-dd')}.xlsx`);
}
