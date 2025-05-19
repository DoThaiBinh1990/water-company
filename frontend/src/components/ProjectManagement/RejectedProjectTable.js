// d:\CODE\water-company\frontend\src\components\ProjectManagement\RejectedProjectTable.js
import React from 'react';
import { FaInfoCircle, FaUndo, FaTrash } from 'react-icons/fa';
import { formatDate } from '../../utils/helpers';
import Pagination from '../Common/Pagination';

function RejectedProjectTable({
  rejectedProjects,
  isLoading,
  user,
  type, // type is used to determine if it's category or minor_repair for display logic if any
  restoreRejectedProject,
  permanentlyDeleteRejectedProject,
  currentPage,
  totalPages,
  setCurrentPage,
  totalItemsCount,
  // Filters are now handled by GenericFilter in ProjectManagement.js
  // filters,
  // setFilters,
}) {
  // The filtering by type and reason is now handled in ProjectManagementLogic/GenericFilter
  // So, rejectedProjects prop should already be filtered.

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mb-4"></div>
        <p className="text-lg text-gray-600">Đang tải danh sách công trình bị từ chối...</p>
      </div>
    );
  }

  if (!isLoading && (!rejectedProjects || rejectedProjects.length === 0)) {
    return (
      <div className="text-center text-gray-500 py-10 bg-white shadow-md rounded-lg">
        <FaInfoCircle size={48} className="mx-auto text-blue-400 mb-4" />
        <p className="text-xl">Không có công trình nào bị từ chối.</p>
        {/* Removed filterReason specific message as filters are external now */}
      </div>
    );
  }

  const getActionTypeDisplay = (actionType) => {
    switch (actionType) {
      case 'new': return 'Yêu cầu tạo mới';
      case 'edit': return 'Yêu cầu sửa';
      case 'delete': return 'Yêu cầu xóa';
      default: return actionType || 'Không xác định';
    }
  };

  const getUserName = (userObject) => {
    if (!userObject) return 'N/A';
    return userObject.fullName || userObject.username || 'N/A';
  };

  return (
    <div className="flex flex-col mt-4">
      {/* Filter input is now handled by GenericFilter in ProjectManagement.js */}
      <div className="table-container-custom">
        <table className="generic-table w-full" style={{ tableLayout: 'auto' }}> {/* Sử dụng w-full và table-layout: auto */}
          <thead>
            <tr>
              <th className="header-cell-custom" style={{ width: '40px' }}>STT</th>
              <th className="header-cell-custom" style={{ minWidth: '200px', textAlign: 'left' }}>Tên CT</th>
              <th className="header-cell-custom" style={{ minWidth: '150px', textAlign: 'left' }}>Địa điểm</th>
              <th className="header-cell-custom" style={{ minWidth: '250px', textAlign: 'left' }}>Quy mô</th>
              <th className="header-cell-custom" style={{ minWidth: '120px' }}>CNPB</th>
              <th className="header-cell-custom" style={{ minWidth: '120px' }}>Loại YC</th>
              <th className="header-cell-custom" style={{ minWidth: '120px' }}>Người YC</th>
              <th className="header-cell-custom" style={{ minWidth: '120px' }}>Người TC</th>
              <th className="header-cell-custom" style={{ minWidth: '100px' }}>Ngày TC</th>
              <th className="header-cell-custom" style={{ minWidth: '150px', textAlign: 'left' }}>Lý do từ chối</th>
              <th className="header-cell-custom sticky-col-last-header" style={{ width: '120px' }}>
                Hành động
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-xs">
            {rejectedProjects.map((project, index) => (
              <tr key={project._id || project.originalProjectId || index} className="table-row-custom">
                <td className="data-cell-custom" style={{ textAlign: 'center' }}>{(currentPage - 1) * 10 + index + 1}</td>
                <td className="data-cell-custom align-left">{project.name || project.details?.name || 'N/A'}</td>
                <td className="data-cell-custom align-left">{project.location || project.details?.location || 'N/A'}</td>
                <td className="data-cell-custom align-left">{project.scale || project.details?.scale || 'N/A'}</td>
                <td className="data-cell-custom">{project.allocatedUnit || project.details?.allocatedUnit || 'N/A'}</td>
                <td className="data-cell-custom">{getActionTypeDisplay(project.actionType)}</td>
                <td className="data-cell-custom">{getUserName(project.createdBy)}</td>
                <td className="data-cell-custom">{getUserName(project.rejectedBy)}</td>
                <td className="data-cell-custom">{formatDate(project.rejectedAt)}</td>
                <td className="data-cell-custom align-left" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{project.rejectionReason || 'N/A'}</td>
                <td className="data-cell-custom sticky-col-last-data">
                  <div className="flex justify-center items-center gap-2">
                    {user?.permissions?.approve && restoreRejectedProject && (
                      <div className="action-btn-wrapper" title="Khôi phục công trình">
                        <button
                          onClick={() => restoreRejectedProject(project._id)}
                          className="btn-icon btn-icon-green"
                          disabled={isLoading} // Or a specific mutation loading state
                        >
                          <FaUndo size={16} />
                        </button>
                      </div>
                    )}
                    {user?.role === 'admin' && permanentlyDeleteRejectedProject && (
                      <div className="action-btn-wrapper" title="Xóa vĩnh viễn">
                        <button
                          onClick={() => permanentlyDeleteRejectedProject(project._id)}
                          className="btn-icon btn-icon-red"
                          disabled={isLoading} // Or a specific mutation loading state
                        >
                          <FaTrash size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rejectedProjects.length === 0 && (
              <tr>
                <td colSpan={11} className="data-cell-custom text-center italic text-gray-500">
                  Không có công trình nào bị từ chối khớp với bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        isSubmitting={isLoading}
      />
      <div className="text-center text-gray-500 text-sm mt-2">
            Hiển thị trang {currentPage} / {totalPages} (Tổng số: {totalItemsCount} công trình)
      </div>
    </div>
  );
}

export default RejectedProjectTable;
