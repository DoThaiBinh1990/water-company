// d:\CODE\water-company\frontend\src\components\ProjectManagement\GenericTable.js
import React from 'react';
import { formatDate, formatCurrency, getNestedProperty } from '../../utils/helpers'; // Ensure getNestedProperty is correctly imported
import Pagination from '../Common/Pagination'; // Import Pagination

function GenericTable({
  data,
  columns,
  user, // User object for permission checks if needed by renderActions
  isSubmitting, // General submitting state for actions
  isPendingTab,
  totalPages,
  currentPage,
  setCurrentPage,
  totalItemsCount,
  renderActions,
  isLoading,
  isFetching, // For skeleton loading
  tableWidth = '100%',
  itemsPerPage = 10,
  usersList = [],
  // backendValidationErrors = {}, // Example: { projectId: { fieldName: "Error" } }
}) {

  const getCellDisplayData = (project, fieldPath, currentUsersList) => {
    let originalValueFromProject = getNestedProperty(project, fieldPath);

    const resolveUserValue = (value) => {
      // Xử lý trường hợp value đã là object (ví dụ: được populate từ backend)
      if (value && typeof value === 'object' && (value._id || value.name || value.fullName || value.username)) {
        return value;
      }
      // Xử lý trường hợp value là string ID
      if (typeof value === 'string' && currentUsersList && currentUsersList.length > 0) {
        if (value.match(/^[0-9a-fA-F]{24}$/)) {
          const foundUser = currentUsersList.find(u => u._id === value);
          return foundUser || value; // Trả về object user nếu tìm thấy, ngược lại trả về ID
        }
      }
      return value; // Trả về giá trị gốc nếu không phải ID hoặc không tìm thấy
    };

    const resolvedOriginalValueFromProject = resolveUserValue(originalValueFromProject);
    let displayValue = resolvedOriginalValueFromProject;
    let isChanged = false;
    let resolvedOldValueForDisplay = null;

    if (project.pendingEdit && Array.isArray(project.pendingEdit.changes)) {
      const changedField = project.pendingEdit.changes.find(change => change.field === fieldPath);
      if (changedField) {
        displayValue = resolveUserValue(changedField.newValue);
        isChanged = true;
        resolvedOldValueForDisplay = changedField.oldValue !== undefined
          ? resolveUserValue(changedField.oldValue)
          : resolvedOriginalValueFromProject;
      }
    }
    return {
      displayValue,
      originalValue: isChanged ? resolvedOldValueForDisplay : null,
      isChanged
    };
  };

  const renderCellContent = (project, colConfig) => {
    const cellData = getCellDisplayData(project, colConfig.field, usersList);
    let displayValue = cellData.displayValue;
    let originalDisplayValue = cellData.originalValue;

    const formatValueForDisplay = (value, formatType) => {
      if (value === null || value === undefined) return 'N/A';
      // Nếu value là object (ví dụ user đã được resolve), lấy fullName hoặc username
      if (typeof value === 'object') {
        return value.fullName || value.username || value.name || '[Đối tượng]';
      }
      if (formatType === 'date') return formatDate(value);
      if (formatType === 'currency') return formatCurrency(value);
      return String(value);
    };

    // Nếu có hàm render tùy chỉnh, nó sẽ chịu trách nhiệm hoàn toàn việc hiển thị cũ/mới
    if (colConfig.render) {
      // Truyền cellData chứa isChanged, displayValue (mới), originalValue (cũ, đã resolve)
      return colConfig.render(project, cellData, isPendingTab, usersList);
    }

    const contentToRender = formatValueForDisplay(displayValue, colConfig.format);
    let formattedOriginalValue = '';
    if (cellData.isChanged && originalDisplayValue !== null && originalDisplayValue !== undefined) {
        formattedOriginalValue = formatValueForDisplay(originalDisplayValue, colConfig.format);
    }

    let finalDisplayElement;
    if (contentToRender === "N/A" || (typeof contentToRender === 'string' && contentToRender.startsWith("["))) { // Kiểm tra cả trường hợp [Đối tượng]
        finalDisplayElement = <span className={`${contentToRender === "N/A" ? "text-gray-400 italic" : "text-red-500 italic"} text-xs`}>{contentToRender}</span>;
    } else {
        finalDisplayElement = contentToRender;
    }

    return (
      <>
        <span className={`${cellData.isChanged ? 'cell-changed-value font-semibold' : ''}`}>
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

  if ((isLoading || isFetching) && (!data || data.length === 0)) {
    const skeletonCols = columns.length + 2;
    return (
      <div className="table-container-custom mt-4">
        <table className="generic-table" style={{ width: tableWidth }}>
          <thead>
            <tr>
              {Array(skeletonCols).fill(0).map((_, idx) => (
                <th key={idx} className="header-cell-custom p-2">
                  <div className="bg-gray-300 animate-pulse h-4 w-full rounded"></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-xs">
            {Array(itemsPerPage).fill(0).map((_, rowIndex) => (
              <tr key={`skeleton-${rowIndex}`}>
                {Array(skeletonCols).fill(0).map((_, colIndex) => (
                  <td key={`skeleton-${rowIndex}-${colIndex}`} className="data-cell-custom p-2">
                    <div className="bg-gray-200 animate-pulse h-4 w-full rounded"></div>
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
        <table className="generic-table table-auto" style={{ width: tableWidth }}>
          <thead>
            <tr>
              <th className="header-cell-custom sticky-col-1-header text-xs" style={{ width: '40px', padding: '0.5rem 0.5rem' }}>
                STT
              </th>
              {columns.map((col, index) => (
                <th
                  key={col.field || `header-${index}`}
                  className={`header-cell-custom ${col.sticky && col.left ? 'sticky-header' : ''} ${col.headerClassName || ''}`}
                  style={{
                    width: col.width, minWidth: col.minWidth || col.width,
                    textAlign: 'center', left: col.sticky ? col.left : undefined,
                    padding: '0.5rem 0.75rem', fontSize: '0.75rem', ...col.headerStyle,
                  }}
                >
                  <div className="flex items-center justify-center">
                    {col.header}
                  </div>
                </th>
              ))}
              <th className="header-cell-custom sticky-col-last-header text-xs" style={{ width: '120px', textAlign: 'center', padding: '0.5rem 0.75rem' }}>
                Hành động
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-xs">
            {data.map((project, index) => (
              <tr key={project._id} className="table-row-custom hover:bg-blue-50 transition-colors duration-150">
                <td className="data-cell-custom sticky-col-1-data" style={{ textAlign: 'center', padding: '0.5rem 0.5rem' }}>
                  {(currentPage - 1) * itemsPerPage + index + 1}
                </td>
                {columns.map((col, colIndex) => {
                  const cellDataForTd = getCellDisplayData(project, col.field, usersList); // Pass usersList
                  return (
                    <td
                      key={`${project._id}-${col.field || `col-${colIndex}`}`}
                      className={`data-cell-custom ${col.sticky && col.left ? 'sticky-data' : ''} ${cellDataForTd.isChanged ? 'cell-changed' : ''} ${col.className || ''}`}
                      style={{
                        textAlign: col.align || 'left', left: col.sticky ? col.left : undefined,
                        padding: '0.5rem 0.75rem', ...col.cellStyle,
                      }}
                      title={col.tooltipRender ? col.tooltipRender(project) : undefined}
                    >
                      {renderCellContent(project, col)}
                    </td>
                  );
                })}
                <td className="data-cell-custom sticky-col-last-data" style={{ textAlign: 'center', padding: '0.5rem 0.5rem' }}>
                  {renderActions && renderActions(project, isPendingTab)} {/* Pass isPendingTab to renderActions */}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        isSubmitting={isLoading || isSubmitting}
      />
       <div className="text-center text-gray-500 text-sm mt-2">
            Hiển thị trang {currentPage} / {totalPages} (Tổng số: {totalItemsCount} mục)
       </div>
    </div>
  );
}

export default GenericTable;
