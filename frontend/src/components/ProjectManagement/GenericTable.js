import React from 'react';
import { FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import { formatDate, formatCurrency } from '../../utils/helpers';

function GenericTable({
  data,
  columns,
  user,
  isSubmitting,
  isPendingTab,
  totalPages,
  currentPage,
  setCurrentPage,
  totalItemsCount,
  renderActions,
  isLoading,
  tableWidth = '100%',
  itemsPerPage = 10,
  usersList = [], // Nhận usersList từ props, mặc định là mảng rỗng
}) {

  const getCellDisplayData = (project, fieldPath, isPending, currentUsersList) => {
    // Lấy giá trị gốc từ project object
    let originalValueFromProject = fieldPath.split('.').reduce((obj, key) => {
        if (obj && typeof obj === 'object' && key in obj) {
            return obj[key];
        }
        return null;
    }, project);

    // Helper để "resolve" ID user thành object user (chứa _id, fullName, username) từ usersList
    const resolveUserValue = (value) => {
      if (typeof value === 'string' && currentUsersList && currentUsersList.length > 0) {
        const foundUser = currentUsersList.find(u => u._id === value);
        return foundUser || value; // Trả về object user nếu tìm thấy, ngược lại trả về ID gốc
      }
      // Nếu value đã là object (ví dụ: đã được populate từ backend hoặc từ lần resolve trước)
      // hoặc không phải string ID, thì trả về chính nó.
      return value;
    };

    // Resolve giá trị gốc từ project nếu nó là ID user
    const resolvedOriginalValueFromProject = resolveUserValue(originalValueFromProject, currentUsersList);

    let displayValue = resolvedOriginalValueFromProject; // Ban đầu, giá trị hiển thị là giá trị gốc (đã resolve nếu là user)
    let isChanged = false;
    let resolvedOldValueForDisplay = null; // Sẽ lưu giá trị cũ đã được resolve

    if (
      isPending &&
      project.pendingEdit &&
      Array.isArray(project.pendingEdit.changes)
    ) {
      const changedField = project.pendingEdit.changes.find(change => change.field === fieldPath);
      if (changedField) {
        // Giá trị MỚI từ pendingEdit, cần được resolve nếu nó là ID user
        displayValue = resolveUserValue(changedField.newValue, currentUsersList);
        isChanged = true;

        // Giá trị CŨ:
        // 1. Ưu tiên lấy từ changedField.oldValue (và resolve nếu nó là ID user)
        // 2. Nếu không có, dùng resolvedOriginalValueFromProject (giá trị gốc từ project, đã được resolve)
        resolvedOldValueForDisplay = changedField.oldValue !== undefined
          ? resolveUserValue(changedField.oldValue, currentUsersList)
          : resolvedOriginalValueFromProject;
      }
    }
    return {
      displayValue, // Giá trị MỚI đã resolve (nếu là user ID và có thay đổi) hoặc giá trị gốc đã resolve
      originalValue: isChanged ? resolvedOldValueForDisplay : null, // Giá trị CŨ đã resolve (nếu có thay đổi)
      isChanged
    };
  };

  const renderCellContent = (project, colConfig) => { // usersList được lấy từ props của GenericTable
    const cellData = getCellDisplayData(project, colConfig.field, isPendingTab, usersList);
    let displayValue = cellData.displayValue; // Đây là giá trị MỚI (đã resolve nếu là user)
    let originalDisplayValue = cellData.originalValue; // Đây là giá trị CŨ (đã resolve nếu là user)

    // Helper function to format value for display (bao gồm cả user object)
    const formatValueForDisplay = (value, formatType) => {
      if (value === null || value === undefined) return 'N/A';
      if (typeof value === 'object') {
        // Ưu tiên fullName, sau đó username, rồi đến name (cho các object khác)
        return value.fullName || value.username || value.name || '[Object]';
      }
      // Nếu giá trị là string ID và chưa được resolve (ít khả năng xảy ra ở đây vì getCellDisplayData đã resolve)
      // nó sẽ được hiển thị như một string.
      if (formatType === 'date') return formatDate(value);
      if (formatType === 'currency') return formatCurrency(value);
      return String(value);
    };

    // Nếu có hàm render tùy chỉnh trong config cột, sử dụng nó
    if (colConfig.render) {
      // Hàm render tùy chỉnh sẽ nhận cellData (chứa displayValue và originalValue đã được resolve)
      const customRenderOutput = colConfig.render(project, cellData, isPendingTab, usersList);
      if (typeof customRenderOutput === 'object' && customRenderOutput !== null && !React.isValidElement(customRenderOutput)) {
        console.error(
          `[GenericTable] Custom render for field "${colConfig.field}" returned an invalid OBJECT. Value:`,
          customRenderOutput,
          "Project Data:", project
        );
        return <span className="text-red-500 italic">[Lỗi render tùy chỉnh: OBJECT]</span>;
      }
      // Nếu hàm render tùy chỉnh trả về string/number và có thay đổi, GenericTable sẽ tự bọc
      // Nếu trả về JSX, nó phải tự xử lý việc hiển thị giá trị cũ/mới
      if (cellData.isChanged && (typeof customRenderOutput === 'string' || typeof customRenderOutput === 'number')) {
        return (
          <>
            <span className={'cell-changed-value font-semibold'}>{customRenderOutput}</span>
            {(originalDisplayValue !== null && originalDisplayValue !== undefined) && (
              <span className="cell-changed-original-value block text-xs text-gray-500 mt-0.5 italic">
                (Cũ: {formatValueForDisplay(originalDisplayValue, colConfig.format)})
              </span>
            )}
          </>
        );
      }
      return customRenderOutput;
    }

    // Xử lý hiển thị mặc định nếu không có hàm render tùy chỉnh
    // Sử dụng formatValueForDisplay để hiển thị giá trị MỚI
    const contentToRender = formatValueForDisplay(displayValue, colConfig.format);

    // Giá trị CŨ đã được format (nếu có thay đổi)
    let formattedOriginalValue = '';
    if (cellData.isChanged && originalDisplayValue !== null && originalDisplayValue !== undefined) {
        formattedOriginalValue = formatValueForDisplay(originalDisplayValue, colConfig.format);
    }

    let finalDisplayElement;
    if (contentToRender === "N/A" || (typeof contentToRender === 'string' && contentToRender.startsWith("["))) {
        finalDisplayElement = <span className={contentToRender === "N/A" ? "text-gray-400 italic" : "text-red-500 italic"}>{contentToRender}</span>;
    } else {
        finalDisplayElement = contentToRender;
    }

    return (
      <>
        <span className={cellData.isChanged ? 'cell-changed-value font-semibold' : ''}>
          {finalDisplayElement}
        </span>
        {cellData.isChanged && (originalDisplayValue !== null && originalDisplayValue !== undefined) && (
          <span className="cell-changed-original-value block text-xs text-gray-500 mt-0.5 italic">
            (Cũ: {formattedOriginalValue})
          </span>
        )}
      </>
    );
  };

  if (isLoading && (!data || data.length === 0)) {
    const skeletonCols = columns.length + 2;
    return (
      <div className="table-container-custom mt-4">
        <table className="generic-table" style={{ width: tableWidth }}>
          <thead><tr>{Array(skeletonCols).fill(0).map((_, idx) => <th key={idx} className="header-cell-custom p-3"><div className="bg-gray-300 animate-pulse h-5 w-full rounded"></div></th>)}</tr></thead>
          <tbody>
            {Array(itemsPerPage).fill(0).map((_, rowIndex) => (
              <tr key={`skeleton-${rowIndex}`}>
                {Array(skeletonCols).fill(0).map((_, colIndex) => (
                  <td key={`skeleton-${rowIndex}-${colIndex}`} className="data-cell-custom p-3">
                    <div className="bg-gray-200 animate-pulse h-5 w-full rounded"></div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="flex flex-col mt-4">
      <div className="table-container-custom">
        <table className="generic-table table-auto" style={{ width: tableWidth }}> {/* Thêm table-auto */}
          <thead>
            <tr>
              <th className="header-cell-custom sticky-col-1-header" style={{ width: '50px' }}>
                STT
              </th>
              {columns.map((col, index) => (
                <th
                  key={col.field || `header-${index}`}
                  className={`header-cell-custom ${col.sticky && col.left ? 'sticky-header' : ''} ${col.headerClassName || ''}`}
                  style={{ // Style cho header
                    width: col.width,
                    minWidth: col.minWidth || col.width,
                    textAlign: col.align || 'center',
                    left: col.sticky ? col.left : undefined,
                    ...col.headerStyle,
                  }}
                >
                  <div className="flex items-center justify-center"> {/* Căn giữa nội dung header */}
                    {col.header}
                    {/* Có thể thêm icon sort ở đây nếu cần */}
                  </div>
                </th>
              ))}
              <th className="header-cell-custom sticky-col-last-header" style={{ width: '150px', textAlign: 'center' }}>
                Hành động
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((project, index) => (
              <tr key={project._id} className="table-row-custom hover:bg-blue-50 transition-colors duration-150"> {/* Thêm hover effect */}
                <td className="data-cell-custom sticky-col-1-data" style={{ textAlign: 'center' }}>
                  {(currentPage - 1) * itemsPerPage + index + 1}
                </td>
                {columns.map((col, colIndex) => {
                  // Đảm bảo usersList được truyền vào đây
                  // This was the critical line to ensure usersList is passed correctly
                  const cellDataForTd = getCellDisplayData(project, col.field, isPendingTab, usersList); 
                  return (
                    <td
                      key={`${project._id}-${col.field || colIndex}`}
                      className={`data-cell-custom ${col.sticky && col.left ? 'sticky-data' : ''} ${cellDataForTd.isChanged ? 'cell-changed' : ''} ${col.className || ''}`}
                      style={{
                        textAlign: col.align || 'center',
                        left: col.sticky ? col.left : undefined,
                        ...col.cellStyle,
                      }}
                      title={col.tooltipRender ? col.tooltipRender(project) : undefined}
                    >
                      {renderCellContent(project, col)}
                    </td>
                  );
                })}
                <td className="data-cell-custom sticky-col-last-data" style={{ textAlign: 'center' }}>
                  {renderActions && renderActions(project)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination-controls mt-4 flex justify-between items-center text-sm">
          <span className="text-gray-600">
            Hiển thị {(currentPage - 1) * itemsPerPage + 1}-
            {Math.min(currentPage * itemsPerPage, totalItemsCount)} trên tổng số {totalItemsCount} mục
          </span>
          <div className="flex">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1 || isLoading}
              className="px-3 py-1 border rounded-l-md bg-white hover:bg-gray-100 disabled:opacity-50"
            >
              Trước
            </button>
            <span className="px-3 py-1 border-t border-b bg-white text-blue-600 font-semibold">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || isLoading}
              className="px-3 py-1 border rounded-r-md bg-white hover:bg-gray-100 disabled:opacity-50"
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default GenericTable;
