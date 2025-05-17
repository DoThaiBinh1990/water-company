import * as XLSX from 'xlsx';

export const exportToExcel = (data, fileName, sheetName = 'Sheet1') => {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    // Optionally, show a toast message to the user
    // import { toast } from 'react-toastify';
    // toast.warn('Không có dữ liệu để xuất file Excel.');
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Generate a file name if not provided, e.g., based on current date
  const finalFileName = `${fileName || 'exported_data'}_${new Date().toISOString().slice(0,10)}.xlsx`;

  XLSX.writeFile(workbook, finalFileName);
};