import * as XLSX from 'xlsx';
import { categoryFormConfig, minorRepairFormConfig } from '../config/formConfigs';

const getHeadersFromFormConfig = (formConfig) => {
  const headers = [];
  formConfig.tabs.forEach(tab => {
    tab.fields.forEach(field => {
      // Ưu tiên các trường có optionsSource hoặc là các trường quan trọng
      // Loại bỏ các trường không cần thiết cho việc nhập liệu ban đầu từ Excel
      if (!['createdBy', 'enteredBy', 'status', 'pendingEdit', 'pendingDelete'].includes(field.name)) {
        let headerName = field.label;
        if (field.required) {
          headerName += ' (*)';
        }
        if (field.optionsSource === 'users' || field.optionsSource === 'approvers') {
          headerName += ' (Nhập Username/Họ tên)';
        }
        headers.push({ header: headerName, fieldName: field.name, required: !!field.required, optionsSource: field.optionsSource });
      }
    });
  });
  return headers;
};

export const generateExcelTemplate = (projectType) => {
  const formConfig = projectType === 'category' ? categoryFormConfig : minorRepairFormConfig;
  const headersConfig = getHeadersFromFormConfig(formConfig);

  // Tạo một dòng dữ liệu mẫu (có thể để trống hoặc có gợi ý)
  // const sampleData = [{}]; // Unused: Bắt đầu với một object rỗng để XLSX tạo header
  // headersConfig.forEach(hc => {
  //   sampleData[0][hc.header] = ''; // Để trống các cột
  // });

  // Tạo sheet với header là hc.header
  const wsData = [headersConfig.map(hc => hc.header)]; // Dòng đầu tiên là header

  const worksheet = XLSX.utils.aoa_to_sheet(wsData);

  // Ghi chú thêm cho người dùng về các trường bắt buộc và định dạng
  // Ví dụ: Thêm một dòng mô tả dưới header
  // XLSX.utils.sheet_add_aoa(worksheet, [["Các trường có dấu (*) là bắt buộc. Với Người phê duyệt/Người theo dõi/Người DT, nhập Username hoặc Họ tên."]], {origin: "A2"});


  const workbook = XLSX.utils.book_new();
  const sheetName = projectType === 'category' ? 'CongTrinhDanhMuc_Mau' : 'SuaChuaNho_Mau';
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const fileName = `FileMau_${sheetName}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

export const readExcelData = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const binaryStr = event.target.result;
        const workbook = XLSX.read(binaryStr, { type: 'binary', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Lấy header từ dòng đầu tiên
        const headerRow = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false })[0];
        
        // Đọc dữ liệu từ dòng thứ 2, map theo fieldName nếu có thể
        // Điều này cần một cơ chế map header từ file Excel sang fieldName của bạn.
        // Để đơn giản, tạm thời giả định header trong file Excel khớp với field.label (sau khi bỏ " (*)")
        // Hoặc, bạn có thể yêu cầu file Excel phải có header là field.name
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
        resolve({jsonData, headerRow});
      } catch (error) {
        console.error("Error reading Excel file:", error);
        reject(new Error("Lỗi đọc file Excel. Định dạng có thể không đúng."));
      }
    };
    reader.onerror = (error) => {
      console.error("FileReader error:", error);
      reject(new Error("Lỗi khi đọc file."));
    };
    reader.readAsBinaryString(file);
  });
};