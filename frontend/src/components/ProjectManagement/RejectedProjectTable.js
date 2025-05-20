// d:\CODE\water-company\frontend\src\components\ProjectManagement\RejectedProjectTable.js
import React from 'react';
import { FaInfoCircle, FaUndo, FaTrash } from 'react-icons/fa';
import { formatDateToLocale } from '../../utils/dateUtils';
import { formatCurrency } from '../../utils/helpers';
import Pagination from '../Common/Pagination';

function RejectedProjectTable({
  rejectedProjects,
  user,
  isLoading,
  type,
  restoreRejectedProject,
  permanentlyDeleteRejectedProject,
  currentPage,
  totalPages,
  setCurrentPage,
  totalItemsCount,
  itemsPerPage,
}) {

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <div className="spinner"></div> {/* Using spinner class from App.css */}
        <p className="text-lg text-gray-600 ml-3">Đang tải danh sách công trình bị từ chối...</p>
      </div>
    );
  }

  if (!isLoading && (!rejectedProjects || rejectedProjects.length === 0)) {
    return (
      <div className="text-center text-gray-500 py-10 bg-white shadow-md rounded-lg card"> {/* Using card class */}
        <FaInfoCircle size={48} className="mx-auto text-blue-400 mb-4" />
        <p className="text-xl">Không có công trình nào bị từ chối.</p>
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
      <div className="table-container">
        <table className="table-fixed w-full" style={{ tableLayout: 'auto' }}>
          <thead className="bg-[var(--primary)] text-white">
            <tr>
              <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-center" style={{ width: '40px' }}>STT</th>
              <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-left" style={{ minWidth: '200px' }}>Tên CT</th>
              <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-left" style={{ minWidth: '150px' }}>Địa điểm</th>
              <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-left" style={{ minWidth: '250px' }}>Quy mô</th>
              <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-center" style={{ minWidth: '120px' }}>CNPB</th>
              <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-center" style={{ minWidth: '120px' }}>Loại YC</th>
              <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-center" style={{ minWidth: '120px' }}>Người YC</th>
              <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-center" style={{ minWidth: '120px' }}>Người TC</th>
              <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-center" style={{ minWidth: '100px' }}>Ngày TC</th>
              <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-left" style={{ minWidth: '150px' }}>Lý do từ chối</th>
              <th className="sticky-col-last px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-center" style={{ width: '120px' }}>
                Hành động
              </th>
            </tr>
          </thead>
          <tbody className="text-xs"> {/* Removed divide-y, relying on td border-b */}
            {rejectedProjects.map((project, index) => (
              <tr key={project._id || project.originalProjectId || index} className="hover:bg-gray-50">
                <td className="px-3 py-2.5 whitespace-nowrap text-center">{itemsPerPage * (currentPage - 1) + index + 1}</td>
                <td className="px-3 py-2.5 whitespace-normal text-left">{project.name || project.details?.name || 'N/A'}</td>
                <td className="px-3 py-2.5 whitespace-normal text-left">{project.location || project.details?.location || 'N/A'}</td>
                <td className="px-3 py-2.5 whitespace-normal text-left">{project.scale || project.details?.scale || 'N/A'}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-center">{project.allocatedUnit || project.details?.allocatedUnit || 'N/A'}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-center">{getActionTypeDisplay(project.actionType)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-center">{getUserName(project.createdBy)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-center">{getUserName(project.rejectedBy)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-center">{formatDateToLocale(project.rejectedAt)}</td>
                <td className="px-3 py-2.5 whitespace-pre-wrap break-words text-left">{project.rejectionReason || 'N/A'}</td>
                <td className="sticky-col-last px-3 py-2.5 whitespace-nowrap text-center">
                  <div className="flex justify-center items-center gap-2">
                    {user?.permissions?.approve && restoreRejectedProject && project.status !== 'restored' && (
                      <div className="action-btn-wrapper" title="Khôi phục công trình">
                        <button
                          onClick={() => restoreRejectedProject(project._id)}
                          className="btn-icon btn-icon-green"
                          disabled={isLoading}
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
                          disabled={isLoading}
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
                <td colSpan={11} className="px-3 py-2.5 text-center italic text-gray-500">
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
