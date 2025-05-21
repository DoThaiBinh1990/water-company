// d:\CODE\water-company\frontend\src\components\ProjectManagement\GenericTable.js
import React from 'react';
import { FaInfoCircle } from 'react-icons/fa'; // Import icon for empty state
import { formatCurrency, getNestedProperty } from '../../utils/helpers';
import { formatDateToLocale } from '../../utils/dateUtils';
import Pagination from '../Common/Pagination';

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
  isFetching,
  tableWidth = '100%',
  itemsPerPage = 10,
  usersList = [],
}) {

  const getCellDisplayData = (project, fieldPath, currentUsersList) => {
    let originalValueFromProject = getNestedProperty(project, fieldPath);

    const resolveUserValue = (value) => {
      if (value && typeof value === 'object' && (value._id || value.name || value.fullName || value.username)) {
        return value;
      }
      if (typeof value === 'string' && currentUsersList && currentUsersList.length > 0) {
        if (value.match(/^[0-9a-fA-F]{24}$/)) {
          const foundUser = currentUsersList.find(u => u._id === value);
          return foundUser || value;
        }
      }
      return value;
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
      // Hiển thị "N/A" cho null, undefined, hoặc chuỗi rỗng
      if (value === null || value === undefined || String(value).trim() === '') return 'N/A';

      if (typeof value === 'object') {
        return value.fullName || value.username || value.name || '[Đối tượng]';
      }
      if (formatType === 'date') return formatDateToLocale ? formatDateToLocale(value) : (value ? String(value) : 'N/A');
      if (formatType === 'currency') return formatCurrency(value);
      return String(value);

    };

    if (colConfig.render) {
      return colConfig.render(project, cellData, isPendingTab, usersList);
    }

    const contentToRender = formatValueForDisplay(displayValue, colConfig.format);
    let formattedOriginalValue = '';
    if (cellData.isChanged && originalDisplayValue !== null && originalDisplayValue !== undefined) {
        formattedOriginalValue = formatValueForDisplay(originalDisplayValue, colConfig.format);
    }

    let finalDisplayElement;
    if (contentToRender === "N/A" || (typeof contentToRender === 'string' && contentToRender.startsWith("["))) {
        finalDisplayElement = <span className={`${contentToRender === "N/A" ? "text-gray-400 italic" : "text-red-500 italic"} text-xs`}>{contentToRender}</span>;
    } else {
        finalDisplayElement = contentToRender;
    }

    return (
      <>
        <span className={`${cellData.isChanged ? 'cell-changed-value' : ''}`}>
          {finalDisplayElement}
        </span>
        {cellData.isChanged && (originalDisplayValue !== null && originalDisplayValue !== undefined) && (
          <span className="cell-changed-original-value">
            (Cũ: {formattedOriginalValue})
          </span>
        )}
      </>
    );
  };

  if ((isLoading || isFetching) && (!data || data.length === 0)) {
    const skeletonCols = columns.length + 2; // +2 for STT and Actions
    return (
      <div className="table-container mt-4">
        <table className="table-fixed" style={{ width: tableWidth }}>
          <thead className="bg-[var(--primary)] text-white">
            <tr>
              {Array(skeletonCols).fill(0).map((_, idx) => (
                <th key={idx} className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider">
                  <div className="bg-gray-300 animate-pulse h-4 w-full rounded"></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-xs">
            {Array(itemsPerPage).fill(0).map((_, rowIndex) => (
              <tr key={`skeleton-${rowIndex}`}>
                {Array(skeletonCols).fill(0).map((_, colIndex) => (
                  <td key={`skeleton-${rowIndex}-${colIndex}`} className="px-3 py-2.5 border-b border-[var(--border)]">
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

  if (!isLoading && !isFetching && (!data || data.length === 0)) {
    return (
      <div className="text-center text-gray-500 py-10 mt-4 bg-white shadow-md rounded-lg card">
        <FaInfoCircle size={40} className="mx-auto text-blue-400 mb-3" />
        <p className="text-lg">Không có công trình nào để hiển thị.</p>
        {/* You can add more specific messages based on props if needed */}
        {/* Example: {isPendingTab && <p className="text-sm mt-1">Không có yêu cầu nào đang chờ xử lý.</p>} */}
      </div>
    );
  }

  return (
    <div className="flex flex-col mt-4">
      <div className="table-container">
        <table className="table-fixed" style={{ width: tableWidth }}>
          <thead className="bg-[var(--primary)] text-white">
            <tr>
              {/* Sử dụng biến CSS cho chiều rộng cột STT */}
              <th
                className="sticky-col-1 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-center"
                style={{ width: 'var(--sticky-col-1-width, 35px)' }} // Giảm fallback xuống 35px
              >
                STT
              </th>
              {columns.map((col, index) => (
                <th
                  key={col.field || `header-${index}`} // Ensure unique key
                  // Luôn áp dụng text-center cho th. Nếu col.align được định nghĩa, nó sẽ được áp dụng cho div bên trong.
                  className={`${col.sticky ? `sticky-col-${col.sticky}` : ''} ${col.headerClassName || ''} px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-center`}
                  style={{
                    width: col.width, minWidth: col.minWidth || col.width,
                    // left: col.sticky ? col.left : undefined, // 'left' is handled by CSS classes like .sticky-col-2
                    ...col.headerStyle,
                  }}
                >
                  {/* Bỏ div bao quanh, để text-center của th trực tiếp căn chỉnh col.header */}
                    {col.header}
                </th>
              ))}
              <th className="sticky-col-last px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-center" style={{ width: '120px' }}>
                Hành động
              </th>
            </tr>
          </thead>
          <tbody className="text-xs"> {/* Removed divide-y, relying on td border-b */}
            {data.map((project, index) => (
              <tr key={project._id || `project-row-${index}`} className="hover:bg-gray-50"> {/* Fallback key */}
                <td className="sticky-col-1 text-center px-3 py-2.5 whitespace-nowrap">
                  {(currentPage - 1) * itemsPerPage + index + 1}
                </td>
                {columns.map((col, colIndex) => {
                  const cellDataForTd = getCellDisplayData(project, col.field, usersList);
                  return (
                    <td
                      key={`${project._id || `project-row-${index}`}-${col.field || `col-${colIndex}`}`} // Fallback key
                      className={`${col.sticky ? `sticky-col-${col.sticky}` : ''} ${cellDataForTd.isChanged ? 'cell-changed' : ''} ${col.className || ''} ${col.align ? `text-${col.align}` : 'text-left'} ${col.breakWords ? 'whitespace-pre-wrap break-words' : 'whitespace-nowrap'} px-3 py-2.5`}
                      style={{
                        // left: col.sticky ? col.left : undefined, // 'left' is handled by CSS classes
                        ...col.cellStyle,
                      }}
                      title={col.tooltipRender ? col.tooltipRender(project) : undefined}
                    >
                      {renderCellContent(project, col)}
                    </td>
                  );
                })}
                <td className="sticky-col-last text-center px-3 py-2.5 whitespace-nowrap">
                  {renderActions && renderActions(project, isPendingTab)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Container cho phân trang và thông tin tổng số */}
      <div className="flex justify-between items-center mt-4 px-2"> {/* Sử dụng flexbox để căn chỉnh */}
        <div className="text-gray-500 text-sm"> {/* Thông tin tổng số ở bên trái */}
          Hiển thị trang {currentPage} / {totalPages} (Tổng số: {totalItemsCount} mục)
        </div>
        {/* Component Pagination ở bên phải */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          isSubmitting={isLoading || isSubmitting}
        />
      </div>
    </div>
  );
}

export default GenericTable;
