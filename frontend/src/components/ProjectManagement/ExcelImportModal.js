// d:\CODE\water-company\frontend\src\components\ProjectManagement\ExcelImportModal.js
import React, { useState, useEffect, useMemo, useCallback } from 'react'; // Add useCallback
import Modal from 'react-modal';
import { FaSave, FaTimes, FaExclamationTriangle, FaSpinner, FaCheckSquare, FaRegSquare } from 'react-icons/fa'; // Thêm icons
import { toast } from 'react-toastify';
import { categoryFormConfig, minorRepairFormConfig } from '../../config/formConfigs';
import { checkExcelDuplicatesAPI } from '../../apiService'; // API kiểm tra trùng lặp
// import { format } from 'date-fns'; // Not strictly needed if backend handles date string

Modal.setAppElement('#root');

const ExcelImportModal = ({
  showModal,
  setShowModal,
  initialData,
  headersConfig: excelHeaders,
  projectType,
  user,
  dataSources,
  onSubmit,
  isSubmitting,
  backendValidationErrors, // New prop for backend errors
}) => {
  const [editedData, setEditedData] = useState([]);
  const [validationErrors, setValidationErrors] = useState({});
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [duplicateCheckResults, setDuplicateCheckResults] = useState([]); // [{isDuplicate, existingProjectName, excelProjectName}]
  const [isLoadingDuplicates, setIsLoadingDuplicates] = useState(false);
  const [areAllNonDuplicateSelected, setAreAllNonDuplicateSelected] = useState(false);

  const formConfig = useMemo(() => projectType === 'category' ? categoryFormConfig : minorRepairFormConfig, [projectType]);

  const tableColumns = useMemo(() => {
    if (!excelHeaders || !formConfig) return [];
    const fieldMap = new Map();
    formConfig.tabs.forEach(tab => {
        tab.fields.forEach(field => {
            const cleanLabel = field.label.replace(' (*)', '').replace(' (Nhập Username/Họ tên)', '').trim().toLowerCase();
            fieldMap.set(cleanLabel, field);
            fieldMap.set(field.name.toLowerCase(), field);
        });
    });
    return excelHeaders.map(header => {
        const cleanHeader = String(header).replace(' (*)', '').replace(' (Nhập Username/Họ tên)', '').trim().toLowerCase();
        const fieldConfig = fieldMap.get(cleanHeader) || { name: header, label: header, type: 'text', required: String(header).includes('(*)') };
        return {
            Header: header,
            accessor: fieldConfig.name,
            config: fieldConfig,
            minWidth: fieldConfig.name === 'name' ? '250px' :
                      (fieldConfig.name === 'location' || fieldConfig.name === 'scale' || fieldConfig.name === 'notes') ? '200px' :
                      (fieldConfig.optionsSource === 'users' || fieldConfig.optionsSource === 'approvers') ? '180px' : '150px',
        };
    });
  }, [excelHeaders, formConfig]);

  const getOptionsForField = useCallback((fieldConfig) => {
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
  }, [dataSources]);

  useEffect(() => {
    const processInitialData = async () => {
      const mappedData = initialData.map(row => {
        const newRow = {};
        tableColumns.forEach(col => {
          const excelHeaderKey = Object.keys(row).find(k =>
            String(k).replace(' (*)', '').replace(' (Nhập Username/Họ tên)', '').trim().toLowerCase() === col.config.label.replace(' (*)', '').replace(' (Nhập Username/Họ tên)', '').trim().toLowerCase() ||
            String(k).toLowerCase() === col.accessor.toLowerCase()
          );
          let value = excelHeaderKey ? row[excelHeaderKey] : (row[col.accessor] || '');

          if ((col.config.optionsSource === 'users' || col.config.optionsSource === 'approvers') && typeof value === 'string') {
            const options = getOptionsForField(col.config);
            const foundOptionByName = options.find(opt => opt.label.toLowerCase() === String(value).toLowerCase());
            if (foundOptionByName) value = foundOptionByName.value;
          }
          // Convert Excel date numbers to JS Date objects if applicable
          if (col.config.type === 'date' && typeof value === 'number' && value > 25569) { // Excel date epoch
            value = new Date(Math.round((value - 25569) * 86400 * 1000));
          }
          newRow[col.accessor] = value;
        });
        return newRow;
      });

      setEditedData(mappedData);
      setValidationErrors({}); // Clear previous errors
      setSelectedRows(new Set()); // Reset selected rows
      setDuplicateCheckResults([]); // Reset duplicate results

      if (mappedData.length > 0) {
        setIsLoadingDuplicates(true);
        try {
          // Chuẩn bị dữ liệu để gửi đi kiểm tra trùng lặp
          const dataToCheck = mappedData.map(row => ({
            name: row.name || null, // Gửi null nếu không có giá trị
            allocatedUnit: row.allocatedUnit || null, // Gửi null nếu không có giá trị
            financialYear: row.financialYear ? parseInt(String(row.financialYear), 10) : null, // Chuyển đổi sang số hoặc null
          }));

          const duplicateResultsFromApi = await checkExcelDuplicatesAPI({ projects: dataToCheck, projectType });
          setDuplicateCheckResults(duplicateResultsFromApi);

          // Tự động chọn các dòng không bị trùng
          const initialSelected = new Set();
          duplicateResultsFromApi.forEach((result, index) => {
            if (!result.isDuplicate) {
              initialSelected.add(index);
            }
          });
          setSelectedRows(initialSelected);

        } catch (error) {
          // Hiển thị lỗi cụ thể hơn từ API nếu có
          const errorMessage = error.response?.data?.message || error.message || "Lỗi khi kiểm tra công trình trùng lặp từ Excel.";
          toast.error(errorMessage, { position: "top-center", autoClose: 5000 });
          console.error("Error checking Excel duplicates:", error);
          setDuplicateCheckResults(mappedData.map(() => ({ isDuplicate: false }))); // Giả định không có gì trùng nếu API lỗi
        } finally {
          setIsLoadingDuplicates(false);
        }
      }
    };
    if (initialData) processInitialData();
  }, [initialData, tableColumns, getOptionsForField]);

  // Effect to merge backend validation errors
  useEffect(() => {
    if (backendValidationErrors && Array.isArray(backendValidationErrors)) {
        const newErrors = { ...validationErrors }; // Start with current frontend errors
        backendValidationErrors.forEach(result => {
            if (!result.success && result.rowIndex !== undefined) {
                if (!newErrors[result.rowIndex]) newErrors[result.rowIndex] = {};
                // Backend error might be a single string or an object of field errors
                if (typeof result.error === 'string') {
                    newErrors[result.rowIndex]['general'] = (newErrors[result.rowIndex]['general'] ? newErrors[result.rowIndex]['general'] + '; ' : '') + result.error;
                } else if (typeof result.error === 'object') { // Assuming backend sends { fieldName: "Error message" }
                    for (const fieldKey in result.error) {
                        newErrors[result.rowIndex][fieldKey] = (newErrors[result.rowIndex][fieldKey] ? newErrors[result.rowIndex][fieldKey] + '; ' : '') + result.error[fieldKey];
                    }
                } else if (result.field && typeof result.message === 'string') { // Alternative backend error format
                    newErrors[result.rowIndex][result.field] = (newErrors[result.rowIndex][result.field] ? newErrors[result.rowIndex][result.field] + '; ' : '') + result.message;
                }
            }
        });
        if (Object.keys(newErrors).length > 0) setValidationErrors(newErrors); // Only set if there are new errors to merge
    }
  }, [backendValidationErrors, validationErrors]);

  // Effect to update "select all" checkbox state
  useEffect(() => {
    if (editedData.length === 0 || duplicateCheckResults.length === 0) {
      setAreAllNonDuplicateSelected(false);
      return;
    }    
    // Lấy danh sách các index của dòng không bị trùng lặp
    const nonDuplicateIndices = editedData
      .map((_, index) => index)
      .filter(index => !duplicateCheckResults[index]?.isDuplicate);
    
    // Nếu không có dòng nào không bị trùng lặp, không thể "chọn tất cả"
    if (nonDuplicateIndices.length === 0) {
      setAreAllNonDuplicateSelected(false);
      return;
    }
    // Kiểm tra xem TẤT CẢ các dòng KHÔNG BỊ TRÙNG LẶP có nằm trong selectedRows không
    const allNonDuplicatesAreSelected = nonDuplicateIndices.every(index => selectedRows.has(index));
    // Và số lượng dòng được chọn phải bằng số lượng dòng không bị trùng lặp
    setAreAllNonDuplicateSelected(allNonDuplicatesAreSelected && selectedRows.size === nonDuplicateIndices.length);

  }, [selectedRows, editedData, duplicateCheckResults]);



  const handleInputChange = (rowIndex, fieldName, value) => {
    const newData = [...editedData];
    newData[rowIndex][fieldName] = value;
    setEditedData(newData);
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      if (newErrors[rowIndex]) {
        delete newErrors[rowIndex][fieldName]; // Clear specific field error
        if (Object.keys(newErrors[rowIndex]).length === 0) delete newErrors[rowIndex];
      }
      return newErrors;
    });
  };

  const validateRow = (row, rowIndex) => {
    const rowErrors = {};
    tableColumns.forEach(col => {
        const field = col.config;
        const value = row[col.accessor];
        const isValueEmpty = value === null || value === undefined || String(value).trim() === '';

        if (field.required && isValueEmpty) {
            rowErrors[field.name] = `${field.label.replace(' (*)', '')} là bắt buộc.`;
        }
        if ((field.optionsSource === 'users' || field.optionsSource === 'approvers') && !isValueEmpty) {
            const options = getOptionsForField(field);
            if (typeof value === 'string' && !options.some(opt => opt.value === value || opt.label.toLowerCase() === value.toLowerCase())) {
                // If it's a string and not found by ID or exact label match, it might be a name to be resolved by backend.
                // For frontend, if it's not an ID and not an exact label, consider it potentially problematic if strict.
                // Let's assume backend handles name-to-ID. If we want stricter frontend, add error here.
            } else if (typeof value !== 'string' && !options.some(opt => opt.value === value)) {
                 // If it's not a string (e.g. a number that's not an ID) and not a valid ID
                // rowErrors[field.name] = `Giá trị không hợp lệ cho ${field.label.replace(' (*)', '')}.`;
            }
        }
        if (field.type === 'date' && !isValueEmpty) {
            const dateValue = new Date(value);
            if (isNaN(dateValue.getTime())) {
                 rowErrors[field.name] = `${field.label.replace(' (*)', '')} không đúng định dạng ngày.`;
            }
        }
        if (field.numeric && !isValueEmpty && isNaN(parseFloat(value))) {
            rowErrors[field.name] = `${field.label.replace(' (*)', '')} phải là số.`;
        }
    });
    return rowErrors;
  };

  const validateAllData = () => {
    const errors = {};
    editedData.forEach((row, rowIndex) => {
      const rowErrors = validateRow(row, rowIndex);
      if (Object.keys(rowErrors).length > 0) errors[rowIndex] = rowErrors;
    });
    // Merge with existing backend errors if any, frontend errors take precedence for now
    // Or, clear frontend errors and only show backend errors after submit attempt.
    // For now, let's merge, but this might need refinement.
    const mergedErrors = { ...backendValidationErrors, ...errors };
    setValidationErrors(mergedErrors);
    return Object.keys(mergedErrors).length === 0;
  };

  const validateSelectedData = () => {
    const errors = {};
    selectedRows.forEach(rowIndex => {
      const row = editedData[rowIndex];
      const rowErrors = validateRow(row, rowIndex); // validateRow đã có sẵn
      if (Object.keys(rowErrors).length > 0) errors[rowIndex] = rowErrors;
    });
    // Merge với backend errors nếu cần, hoặc chỉ hiển thị lỗi frontend cho các dòng được chọn
    const currentValidationErrors = { ...backendValidationErrors }; // Giữ lại lỗi backend nếu có
    selectedRows.forEach(rowIndex => { // Ghi đè/thêm lỗi frontend cho các dòng được chọn
        if (errors[rowIndex]) currentValidationErrors[rowIndex] = { ...(currentValidationErrors[rowIndex] || {}), ...errors[rowIndex]};
        else if (currentValidationErrors[rowIndex]) delete currentValidationErrors[rowIndex]; // Xóa lỗi cũ nếu dòng đó giờ hợp lệ
    });
    setValidationErrors(currentValidationErrors);
    return Object.values(currentValidationErrors).every(rowErr => Object.keys(rowErr).length === 0);
  };

  const handleToggleRowSelection = (rowIndex) => {
    // Không cho chọn nếu dòng đó bị trùng lặp
    if (duplicateCheckResults[rowIndex]?.isDuplicate) return;

    setSelectedRows(prevSelected => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(rowIndex)) {
        newSelected.delete(rowIndex);
      } else {
        newSelected.add(rowIndex);
      }
      return newSelected;
    });
  };

  const handleToggleSelectAll = () => {
    const nonDuplicateIndices = editedData
      .map((_, index) => index)
      .filter(index => !duplicateCheckResults[index]?.isDuplicate);

    // Nếu tất cả các dòng không trùng lặp ĐÃ được chọn, thì hành động này là BỎ CHỌN TẤT CẢ
    if (nonDuplicateIndices.length > 0 && nonDuplicateIndices.every(index => selectedRows.has(index))) {
      setSelectedRows(new Set());
    } else { // Ngược lại (chưa chọn hết hoặc chưa chọn gì) -> CHỌN TẤT CẢ các dòng không trùng
      setSelectedRows(new Set(nonDuplicateIndices));
    }
  };

  const handleSubmit = () => {
    const dataToSubmit = editedData.filter((_, index) => selectedRows.has(index));
    if (dataToSubmit.length === 0) {
      toast.info("Vui lòng chọn ít nhất một công trình để tải lên.", { position: "top-center" });
      return;
    }
    if (!validateSelectedData()) { // Sử dụng hàm validate mới
      toast.error("Vui lòng sửa các lỗi trong bảng trước khi tải lên.", { position: "top-center" });
      return;
    }
    onSubmit(dataToSubmit);
  };

  const handleClose = () => {
    setShowModal(false);
    setEditedData([]);
    setValidationErrors({});
  };

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

      <div className="p-5 overflow-y-auto flex-grow relative">
        {(isLoadingDuplicates || isSubmitting) && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex flex-col items-center justify-center z-30">
            <FaSpinner className="animate-spin text-blue-500 text-4xl mb-3" />
            <p className="text-gray-700">{isLoadingDuplicates ? 'Đang kiểm tra trùng lặp...' : 'Đang tải lên...'}</p>
          </div>
        )}
        {editedData.length === 0 && !isLoadingDuplicates ? (
          <p className="text-center text-gray-500">Không có dữ liệu để hiển thị.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 border border-gray-300" style={{ tableLayout: 'auto' }}>
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r sticky left-0 bg-gray-50 z-20" style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-400 focus:ring-blue-500 disabled:opacity-50"
                      checked={areAllNonDuplicateSelected}
                      onChange={handleToggleSelectAll}
                      disabled={isLoadingDuplicates || editedData.filter((_, idx) => !duplicateCheckResults[idx]?.isDuplicate).length === 0}
                      title={areAllNonDuplicateSelected ? "Bỏ chọn tất cả công trình hợp lệ" : "Chọn tất cả công trình hợp lệ"}
                    />
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r sticky left-0 bg-gray-50 z-20" style={{ minWidth: '50px' }}>STT</th>
                  {tableColumns.map((col) => (
                    <th
                      key={col.accessor}
                      className={`px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r
                                  ${col.accessor === 'name' ? 'sticky left-[90px] bg-gray-50 z-20' : ''}
                                  ${col.accessor === 'projectCode' ? 'sticky left-[340px] bg-gray-50 z-20' : ''}
                                `}
                      // Thêm style left cho các cột sticky khác nếu cần, dựa trên độ rộng của các cột trước đó
                      style={{ minWidth: col.minWidth }}
                    >
                      {col.Header}
                      {col.config.required && <span className="text-red-500 ml-1">*</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {editedData.map((row, rowIndex) => {
                  const isDuplicate = duplicateCheckResults[rowIndex]?.isDuplicate;
                  const existingProjectName = duplicateCheckResults[rowIndex]?.existingProjectName;
                  // Đảm bảo validationErrors[rowIndex] là một object trước khi lấy keys
                  const rowHasError = validationErrors && typeof validationErrors === 'object' && validationErrors[rowIndex] && Object.keys(validationErrors[rowIndex] || {}).length > 0;
                  let rowClass = 'hover:bg-gray-50 transition-colors duration-150'; // Lớp cơ bản
                  if (isDuplicate) {
                    rowClass = 'bg-yellow-100 hover:bg-yellow-200 opacity-80 cursor-not-allowed'; // Màu vàng cho dòng trùng lặp
                  } else if (rowHasError) {
                    rowClass = 'bg-red-100 hover:bg-red-200'; // Màu đỏ cho dòng có lỗi
                  } else if (selectedRows.has(rowIndex)) {
                    rowClass = 'bg-blue-100 hover:bg-blue-200'; // Màu xanh cho dòng được chọn (và không trùng/lỗi)
                  }

                  return (
                  <tr key={rowIndex} className={rowClass}>
                    <td className="px-2 py-1 whitespace-nowrap text-center border-r sticky left-0 bg-white hover:bg-gray-50 z-10">
                       <input
                        type="checkbox"
                        className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-400 focus:ring-blue-500 disabled:opacity-50"
                        checked={selectedRows.has(rowIndex)}
                        onChange={() => handleToggleRowSelection(rowIndex)}
                        disabled={isDuplicate || isLoadingDuplicates}
                      />
                    </td>
                    <td className={`px-2 py-1 whitespace-nowrap text-xs text-gray-700 border-r sticky left-0 bg-white hover:bg-gray-50 z-10 ${isDuplicate ? 'left-[40px]' : 'left-[40px]'}`}>{rowIndex + 1}</td>
                    {tableColumns.map((col) => {
                      const fieldConfig = col.config;
                      const cellValue = row[col.accessor];
                      const error = validationErrors[rowIndex]?.[fieldConfig.name] || validationErrors[rowIndex]?.general;
                      const options = (fieldConfig.type === 'select' ||
                                       fieldConfig.optionsSource === 'users' ||
                                       fieldConfig.optionsSource === 'approvers' ||
                                       fieldConfig.optionsSource) // Thêm điều kiện này để lấy options cho các select khác
                                      ? getOptionsForField(fieldConfig) : [];

                      const isUserOrApproverField = fieldConfig.optionsSource === 'users' || fieldConfig.optionsSource === 'approvers';
                      const currentOption = isUserOrApproverField ? options.find(opt => opt.value === cellValue) : null;
                      const showSelect = (fieldConfig.type === 'select' || isUserOrApproverField);

                      let displayInputValue = cellValue;
                      if (cellValue instanceof Date) {
                        displayInputValue = cellValue.toISOString().split('T')[0];
                      } else if (isUserOrApproverField && currentOption) {
                        // If it's a user/approver field and we have a valid ID selected,
                        // the input field (if not select) should show the label.
                        // The select will handle this via its options.
                        // This logic is more for when we might render a text input instead of select.
                      }


                      return (
                        <td key={`${rowIndex}-${col.accessor}`}
                            className={`px-1 py-0.5 whitespace-nowrap border-r
                                      ${col.accessor === 'name' ? 'sticky left-[90px] bg-white z-10' : ''}
                                      ${col.accessor === 'projectCode' ? 'sticky left-[340px] bg-white z-10' : ''}
                                    `} style={{ minWidth: col.minWidth }}>
                          {showSelect ? (
                            <select
                              value={cellValue ?? ''} // Sử dụng ?? để xử lý null/undefined
                              onChange={(e) => handleInputChange(rowIndex, fieldConfig.name, e.target.value)}
                              className={`w-full p-1 border text-xs rounded ${error ? 'border-red-500' : 'border-gray-300'} focus:ring-blue-500 focus:border-blue-500`}
                            >
                              <option value="">-- Chọn {fieldConfig.label.toLowerCase().replace(' (*)', '')} --</option>
                              {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                          ) : (
                            <input
                              type={fieldConfig.type === 'date' ? 'date' : (fieldConfig.numeric ? 'number' : 'text')}
                              value={displayInputValue ?? ''} // Sử dụng ??
                              onChange={(e) => handleInputChange(rowIndex, fieldConfig.name, e.target.value)} // Giữ nguyên text-xs, tăng padding cho mobile
                              className={`w-full p-[0.375rem] md:p-1 border text-xs rounded ${error ? 'border-red-500' : 'border-gray-300'} focus:ring-blue-500 focus:border-blue-500`}
                            />
                          )}
                          {error && <p className="text-red-500 text-xs mt-0.5 flex items-center"><FaExclamationTriangle className="mr-1"/> {error}</p>}
                          {isDuplicate && col.accessor === 'name' && ( // Chỉ hiển thị thông báo trùng ở cột tên
                            <p className="text-yellow-700 font-semibold text-xs mt-0.5 flex items-center" title={`Công trình này (tên, đơn vị, năm) đã tồn tại trong hệ thống với tên: ${existingProjectName || 'Không rõ'}`}>
                              <FaExclamationTriangle className="mr-1"/> Trùng lặp
                            </p>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  );
                })}
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
          disabled={isSubmitting || editedData.length === 0 || selectedRows.size === 0 || isLoadingDuplicates}
          className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:bg-blue-300"
        >
          <FaSave className="mr-2" /> {isSubmitting ? 'Đang tải lên...' : 'Xác nhận & Tải lên'}
        </button>
      </div>
    </Modal>
  );
};

export default ExcelImportModal;
