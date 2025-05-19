// src/components/ProjectManagement/ProjectTableCell.js
import React from 'react';
import { formatDate, formatCurrency, getNestedProperty } from '../../utils/projectUtils'; // Adjust path if necessary

function ProjectTableCell({ project, colConfig, isPendingTab }) {
  let displayValue; // Declare displayValue here
  // Safely get the value using the nested path
  const value = getNestedProperty(project, colConfig.field);

  // Check if this cell contains a pending change
  const pendingEdit = project.pendingEdit;
  const isChanged = pendingEdit && pendingEdit.changes && getNestedProperty(pendingEdit.changes, colConfig.field) !== undefined;

  // Apply formatting based on colConfig
  if (value !== null && value !== undefined && value !== '') { // Added check for empty string
    if (colConfig.format === 'date') {
      displayValue = formatDate(value);
    } else if (colConfig.format === 'currency') {
      displayValue = formatCurrency(value);
    } else if (typeof value === 'boolean') {
      displayValue = value ? 'Có' : 'Không';
    } else if (Array.isArray(value)) {
       displayValue = value.join(', ');
    } else if (typeof value === 'object' && value !== null && colConfig.field.includes('.')) {
        // This case might be redundant if getNestedProperty works as expected
        displayValue = String(value); // Default to string conversion
    } else {
      displayValue = String(value);
    }
  } else {
      displayValue = 'N/A'; // Display N/A for null/undefined/empty string values
  }

  // Tooltip for pending changes
  const tooltipLines = [];
  if (isChanged) {
    const originalValue = getNestedProperty(pendingEdit.original, colConfig.field);
    const newValue = getNestedProperty(pendingEdit.changes, colConfig.field);
    tooltipLines.push(`Giá trị cũ: ${originalValue !== null && originalValue !== undefined && originalValue !== '' ? originalValue : 'N/A'}`);
    tooltipLines.push(`Giá trị mới: ${newValue !== null && newValue !== undefined && newValue !== '' ? newValue : 'N/A'}`);
  }

  // Determine cell classes based on colConfig and state
  const cellClasses = [
    'px-4',
    'py-2', // Reduced vertical padding
    'border-r',
    'border-gray-300',
    colConfig.className || '', // Apply custom classes from colConfig (e.g., sticky-col-*)
    isChanged ? 'bg-yellow-100' : '', // Highlight changed cells
    // Background color for sticky cells is handled by global CSS or colConfig.style
    colConfig.align === 'center' ? 'text-center' : (colConfig.align === 'right' || colConfig.format === 'currency') ? 'text-right' : 'text-left',
  ].filter(Boolean).join(' ');

  // Ensure sticky cells have a white background if not overridden by specific styles
  const finalStyle = { ...(colConfig.style || {}) };
  if (colConfig.className && (colConfig.className.includes('sticky-col-1') || colConfig.className.includes('sticky-col-2') || colConfig.className.includes('sticky-col-last'))) {
    if (!finalStyle.backgroundColor) {
      finalStyle.backgroundColor = 'white';
    }
  }


  return (
    <td
      key={`${project._id}-${colConfig.field}`}
      className={cellClasses}
      style={finalStyle} // Apply specific styles from colConfig (e.g., sticky positioning)
      title={tooltipLines.join('\n')} // Show tooltip if there are pending changes
    >
      {displayValue}
    </td>
  );
}

export default ProjectTableCell;
