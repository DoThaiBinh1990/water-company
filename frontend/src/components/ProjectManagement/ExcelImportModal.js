// d:\CODE\water-company\frontend\src\components\ProjectManagement\ExcelImportModal.js
import React, { useState, useEffect, useMemo } from 'react';
import Modal from 'react-modal';
import { FaSave, FaTimes, FaExclamationTriangle } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { categoryFormConfig, minorRepairFormConfig } from '../../config/formConfigs';

Modal.setAppElement('#root');

const ExcelImportModal = ({
  showModal,
  setShowModal,
  initialData, // Dữ liệu đọc từ Excel (mảng các object)
  headersConfig: excelHeaders, // Header đọc từ file Excel
  projectType,
  user,
  dataSources, // { allocatedUnits, usersList, approversList, projectTypesList, ... }
  onSubmit,
  isSubmitting,
}) => {
  const [editedData, setEditedData] = useState([]);
  const [validationErrors, setValidationErrors] = useState({}); // { rowIndex: { fieldName: "Error message" } }

  const formConfig = useMemo(() => projectType === 'category' ? categoryFormConfig : minorRepairFormConfig, [projectType]);

  // Map header từ Excel sang fieldName và lấy config của field đó
  const tableColumns = useMemo(() => {
    if (!excelHeaders || !formConfig) return [];
    
    const fieldMap = new Map();
    formConfig.tabs.forEach(tab => {
        tab.fields.forEach(field => {
            fieldMap.set(field.label.replace(' (*)', '').replace(' (Nhập Username/Họ tên)', '').trim().toLowerCase(), field);
            fieldMap.set(field.name.toLowerCase(), field); // Map bằng fieldName nữa cho chắc
        });
    });

    return excelHeaders.map(header => {
        const cleanHeader = String(header).replace(' (*)', '').replace(' (Nhập Username/Họ tên)', '').trim().toLowerCase();
        const fieldConfig = fieldMap.get(cleanHeader) || { name: header, label: header, type: 'text' }; // Fallback
        return {
            Header: header, // Hiển thị header gốc từ Excel
            accessor: fieldConfig.name, // Dùng field.name để truy cập dữ liệu
            config: fieldConfig, // Lưu config của field,
            // Thêm minWidth gợi ý cho một số cột phổ biến
            minWidth: fieldConfig.name === 'name' ? '250px' :
                      (fieldConfig.name === 'location' || fieldConfig.name === 'scale' || fieldConfig.name === 'notes') ? '200px' :
                      (fieldConfig.optionsSource === 'users' || fieldConfig.optionsSource === 'approvers') ? '180px' :
                      '150px',
        };
    });
  }, [excelHeaders, formConfig]);


  useEffect(() => {
    if (initialData) {
      const mappedData = initialData.map(row => {
        const newRow = {};
        tableColumns.forEach(col => {
          const excelHeaderKey = Object.keys(row).find(k => 
            String(k).replace(' (*)', '').replace(' (Nhập Username/Họ tên)', '').trim().toLowerCase() === col.config.label.replace(' (*)', '').replace(' (Nhập Username/Họ tên)', '').trim().toLowerCase() ||
            String(k).toLowerCase() === col.accessor.toLowerCase()
          );
          let value = excelHeaderKey ? row[excelHeaderKey] : (row[col.accessor] || '');
          
          // Nếu là trường user/approver và giá trị từ Excel là tên, cố gắng tìm ID
          // Backend sẽ là nơi quyết định cuối cùng, đây chỉ là gợi ý cho UI
          if ((col.config.optionsSource === 'users' || col.config.optionsSource === 'approvers') && typeof value === 'string') {
            const options = getOptionsForField(col.config);
            const foundOptionByName = options.find(opt => opt.label.toLowerCase() === String(value).toLowerCase());
            if (foundOptionByName) {
              value = foundOptionByName.value; // Chuyển thành ID nếu tìm thấy bằng tên
            }
          }
          newRow[col.accessor] = value;
        });
        return newRow;
      });
      setEditedData(mappedData);
    }
  }, [initialData, tableColumns, dataSources]); // Thêm dataSources vào dependency

  const handleInputChange = (rowIndex, fieldName, value) => {
    const newData = [...editedData];
    newData[rowIndex][fieldName] = value;
    setEditedData(newData);
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      if (newErrors[rowIndex]) {
        delete newErrors[rowIndex][fieldName];
        if (Object.keys(newErrors[rowIndex]).length === 0) {
          delete newErrors[rowIndex];
        }
      }
      return newErrors;
    });
  };

  const getOptionsForField = (fieldConfig) => {
    if (!fieldConfig || !dataSources) return [];
    switch (fieldConfig.optionsSource) {
      case 'allocatedUnits': return dataSources.allocatedUnits?.map(opt => ({ value: typeof opt === 'string' ? opt : opt.name, label: typeof opt === 'string' ? opt : opt.name })) || [];
      case 'allocationWaves': return dataSources.allocationWavesList?.map(opt => ({ value: typeof opt === 'string' ? opt : opt.name, label: typeof opt === 'string' ? opt : opt.name })) || [];
      case 'constructionUnits': return dataSources.constructionUnitsList?.map(opt => ({ value: typeof opt === 'string' ? opt : opt.name, label: typeof opt === 'string' ? opt : opt.name })) || [];
      case 'users': return dataSources.usersList?.map(u => ({ value: u._id, label: u.fullName || u.username })) || [];
      case 'approvers': return dataSources.approversList?.map(a => ({ value: a._id, label: a.fullName || a.username })) || [];
      case 'projectTypes': return dataSources.projectTypesList?.map(pt => ({ value: typeof pt === 'string' ? pt : pt.name, label: typeof pt === 'string' ? pt : pt.name })) || [];
      default: return fieldConfig.options || [];
    }
  };

  const validateData = () => {
    const errors = {};
    const basicInfoFields = formConfig.tabs.find(tab => tab.name === 'basic')?.fields || [];

    editedData.forEach((row, rowIndex) => {
      const rowErrors = {};
      basicInfoFields.forEach(field => {
        if (field.required) {
          const value = row[field.name];
          if (value === null || value === undefined || String(value).trim() === '') {
            rowErrors[field.name] = `${field.label} là bắt buộc.`;
          }
          if ((field.optionsSource === 'users' || field.optionsSource === 'approvers') && value) {
            const options = getOptionsForField(field);
            const isValidOption = options.some(opt => opt.value === value); // Value phải là ID
            if (!isValidOption) {
                // Nếu value không phải ID (ví dụ là tên từ Excel chưa map được), thì báo lỗi
                // Trừ khi backend có thể tự tìm ID từ tên (nhưng ở đây ta muốn người dùng chọn ID)
                rowErrors[field.name] = `Giá trị "${value}" không hợp lệ cho ${field.label}. Vui lòng chọn từ danh sách.`;
            }
          } else if (field.type === 'select' && value && field.optionsSource && !['users', 'approvers'].includes(field.optionsSource)) {
            const options = getOptionsForField(field);
            const isValidOption = options.some(opt => opt.value === value || opt.label === value);
             if (!isValidOption) {
                rowErrors[field.name] = `Giá trị "${value}" không hợp lệ cho ${field.label}. Vui lòng chọn từ danh sách.`;
             }
          }
        }
      });
      if (Object.keys(rowErrors).length > 0) {
        errors[rowIndex] = rowErrors;
      }
    });
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => { // Chuyển thành async để xử lý response từ backend
    if (!validateData()) {
      toast.error("Vui lòng sửa các lỗi trong bảng trước khi tải lên.", { position: "top-center" });
      return;
    }
    // Gọi onSubmit (là submitExcelData từ ProjectManagementLogic)
    // onSubmit bây giờ nên trả về một promise để biết kết quả từ backend
    // Nếu backend trả về lỗi, chúng ta sẽ cập nhật validationErrors
    // Nếu thành công, ProjectManagementLogic sẽ tự đóng modal và hiển thị toast.
    // Vì vậy, ở đây chúng ta không cần trực tiếp xử lý đóng modal khi thành công.
    // ProjectManagementLogic sẽ gọi setShowExcelImportModal(false) khi mutation thành công.

    // Quan trọng: `onSubmit` (chính là `submitExcelData` trong logic) sẽ gọi mutation.
    // Mutation đó đã có `onSuccess` và `onError`. Chúng ta không cần xử lý đóng modal ở đây nữa.
    onSubmit(editedData);
  };

  const handleClose = () => {
    setShowModal(false);
    setEditedData([]);
    setValidationErrors({});
  }

  if (!showModal) return null;

  return (
    <Modal
      isOpen={showModal}
      onRequestClose={handleClose}
      style={{
        overlay: { zIndex: 1001, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        content: { position: 'relative', margin: 'auto', width: '90%', maxWidth: '1200px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '0', border:'1px solid #ccc', borderRadius: '8px' }
      }}
      contentLabel="Xem và Chỉnh sửa Dữ liệu Excel"
    >      
      <div className="p-5 bg-gray-100 border-b border-gray-300">
        <h2 className="text-xl font-semibold text-gray-800">Xem trước và Chỉnh sửa Dữ liệu từ Excel</h2>
        <p className="text-sm text-gray-600">Kiểm tra và chỉnh sửa dữ liệu trước khi tải lên. Các trường có dấu (*) là bắt buộc.</p>
      </div>

      <div className="p-5 overflow-y-auto flex-grow">
        {editedData.length === 0 ? (
          <p className="text-center text-gray-500">Không có dữ liệu để hiển thị.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 border border-gray-300" style={{ tableLayout: 'auto' }}>
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r sticky left-0 bg-gray-50 z-20" style={{ minWidth: '50px' }}>STT</th>
                  {tableColumns.map((col, colIndex) => (
                    <th 
                      key={col.accessor || colIndex} 
                      className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r"
                      style={{ minWidth: col.minWidth }}
                    >
                      {col.Header}
                      {col.config.required && <span className="text-red-500 ml-1">*</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {editedData.map((row, rowIndex) => (
                  <tr key={rowIndex} className={`${Object.keys(validationErrors[rowIndex] || {}).length > 0 ? 'bg-red-50' : ''} hover:bg-gray-50`}>
                    <td className="px-2 py-1 whitespace-nowrap text-xs text-gray-700 border-r sticky left-0 bg-white hover:bg-gray-50 z-10">{rowIndex + 1}</td>
                    {tableColumns.map((col, colIndex) => {
                      const fieldConfig = col.config;
                      const cellValue = row[col.accessor] || ''; // Đây có thể là ID (nếu đã chọn) hoặc tên (từ Excel)
                      const error = validationErrors[rowIndex]?.[fieldConfig.name];
                      const options = (fieldConfig.type === 'select' || fieldConfig.optionsSource === 'users' || fieldConfig.optionsSource === 'approvers') 
                                      ? getOptionsForField(fieldConfig) 
                                      : [];
  
                      // Luôn hiển thị select cho trường user/approver nếu có lỗi hoặc trống và bắt buộc
                      // Hoặc nếu giá trị hiện tại không phải là ID hợp lệ trong options
                      const isUserOrApproverField = fieldConfig.optionsSource === 'users' || fieldConfig.optionsSource === 'approvers';
                      const isInvalidUserOrApproverValue = isUserOrApproverField && cellValue && !options.some(opt => opt.value === cellValue);
                      
                      const showSelect = (fieldConfig.type === 'select' || isUserOrApproverField) && 
                                         (error || (fieldConfig.required && !cellValue) || isInvalidUserOrApproverValue);
  
                      let displayInputValue = cellValue;
                      if (isUserOrApproverField && !showSelect) { // Chỉ hiển thị tên nếu không phải là select và là ID
                          const selectedOption = options.find(opt => opt.value === cellValue);
                          if (selectedOption) {
                              displayInputValue = selectedOption.label;
                          }
                          // Nếu cellValue là tên từ Excel và không có lỗi (không showSelect), vẫn hiển thị tên đó.
                          // Backend sẽ cố gắng map tên này.
                      } else if (fieldConfig.type === 'date' && cellValue instanceof Date) {
                          displayInputValue = cellValue.toISOString().split('T')[0];
                      }
  
                      return (
                        <td key={`${rowIndex}-${col.accessor}`} className="px-1 py-0.5 whitespace-nowrap border-r" style={{ minWidth: col.minWidth }}>
                          {showSelect ? (
                            <select
                              value={cellValue} // value của select là ID (nếu cellValue là ID) hoặc tên (nếu từ Excel và chưa map)
                                               // Nếu là tên, nó sẽ không khớp option nào và hiển thị "Chọn..."
                              onChange={(e) => handleInputChange(rowIndex, fieldConfig.name, e.target.value)} // e.target.value sẽ là ID
                              className={`w-full p-1 border text-xs rounded ${error ? 'border-red-500' : 'border-gray-300'} focus:ring-blue-500 focus:border-blue-500`}
                            >
                              <option value="">-- Chọn {fieldConfig.label.toLowerCase().replace(' (*)', '')} --</option>
                              {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                          ) : (
                            <input
                              type={fieldConfig.type === 'date' ? 'date' : 'text'}
                              value={displayInputValue}
                              onChange={(e) => {
                                // Nếu là trường user/approver và người dùng gõ text, lưu text đó.
                                // Backend sẽ xử lý việc tìm ID từ text này.
                                handleInputChange(rowIndex, fieldConfig.name, e.target.value);
                              }}
                              className={`w-full p-1 border text-xs rounded ${error ? 'border-red-500' : 'border-gray-300'} focus:ring-blue-500 focus:border-blue-500`}
                            />
                          )}
                          {error && <p className="text-red-500 text-xs mt-0.5 flex items-center"><FaExclamationTriangle className="mr-1"/> {error}</p>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="p-5 bg-gray-100 border-t border-gray-300 flex justify-end gap-3">
        <button
          type="button"
          onClick={handleClose}
          disabled={isSubmitting}
          className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          <FaTimes className="mr-2" /> Hủy
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || editedData.length === 0}
          className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:bg-blue-300"
        >
          <FaSave className="mr-2" /> {isSubmitting ? 'Đang tải lên...' : 'Xác nhận & Tải lên'}
        </button>
      </div>
    </Modal>
  );
};

export default ExcelImportModal;