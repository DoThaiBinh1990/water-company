import { FaPlus, FaEdit, FaTrash, FaCheckCircle, FaTimesCircle, FaWrench, FaUser } from 'react-icons/fa';
import ProjectManagementLogic from './ProjectManagementLogic';
import ProjectManagementTabs from './ProjectManagementTabs';
// Import GenericFilter và cấu hình filter
import GenericFilter from './GenericFilter';
import { categoryFilterConfig, minorRepairFilterConfig } from '../../config/filterConfigs';

import GenericFormModal from './GenericFormModal';
import GenericTable from './GenericTable';
import { categoryProjectColumns, minorRepairProjectColumns } from '../../config/tableConfigs'; // Import cấu hình cột
import { categoryFormConfig, minorRepairFormConfig } from '../../config/formConfigs'; // Import cấu hình form

import RejectedProjectTable from './RejectedProjectTable';

function ProjectManagement({ user, type, showHeader, addMessage }) {
  const {
    filteredProjects,
    pendingProjects,
    rejectedProjects,
    totalPages,
    currentPage,
    setCurrentPage,
    sortOrder,
    setSortOrder,
    showFilter,
    setShowFilter,
    totalProjectsCount,
    formData, // Đã đổi tên từ newProject
    setFormData, // Đã đổi tên từ setNewProject
    editProject,
    setEditProject,
    allocateWaves,
    setAllocateWaves,
    assignPersons,
    setAssignPersons, // Giữ lại setter này vì nó dùng trong renderTableActions
    filters, // Lấy state filters đã gom nhóm
    setFilters, // Lấy setter filters đã gom nhóm
    allocatedUnits,
    constructionUnitsList,
    allocationWavesList,
    usersList,
    approversList, // Lấy từ logic
    projectTypesList, // Lấy từ logic
    showModal,
    setShowModal,
    isLoading,
    isSubmittingAction, // Lấy isSubmittingAction từ logic
    isSubmitting,
    activeTab,
    setActiveTab,
    initialFormData, // Đã đổi tên
    saveProject,
    handleResetFilters,
    openAddNewModal,
    openEditModal,
    deleteProject,
    approveProject,
    rejectProject,
    allocateProject,
    assignProject,
    approveEditProject,
    rejectEditProject,
    approveDeleteProject,
    rejectDeleteProject,
    restoreRejectedProject, // Lấy hàm mới
    permanentlyDeleteRejectedProject, // Lấy hàm mới
  } = ProjectManagementLogic({ user, type, showHeader, addMessage });

  const isCategory = type === 'category';
  const itemsPerPage = 10; // Hoặc lấy từ logic nếu động
  const isPendingTab = activeTab === 'pending'; // Khai báo isPendingTab ở đây

  // Chọn cấu hình form dựa trên type
  const currentFormConfig = isCategory
    ? categoryFormConfig
    : minorRepairFormConfig;

  // Chọn cấu hình filter dựa trên type
  const currentFilterConfig = isCategory
    ? categoryFilterConfig
    : minorRepairFilterConfig;

  const currentTableColumns = isCategory ? categoryProjectColumns : minorRepairProjectColumns;

  // Hàm render actions cho GenericTable
  const renderTableActions = (project) => {
    const commonEditButton = user?.permissions?.edit && !isPendingTab && (
      <div className="action-btn-wrapper" title={project.pendingEdit ? "YC sửa đang chờ" : project.pendingDelete ? "YC xóa đang chờ" : "Sửa/Xem"}>
        <button onClick={() => openEditModal(project)} className="btn-icon btn-icon-teal" disabled={isSubmittingAction || !!project.pendingEdit || !!project.pendingDelete}><FaEdit size={16} /></button>
      </div>
    );
    const commonDeleteButton = user?.permissions?.delete && !isPendingTab && (
      <div className="action-btn-wrapper" title={project.pendingDelete ? "Đang chờ duyệt xóa" : "Xóa"}>
        <button onClick={() => deleteProject(project._id)} className="btn-icon btn-icon-red" disabled={isSubmittingAction || !!project.pendingDelete}><FaTrash size={16} /></button>
      </div>
    );

    const pendingTabActionsContent = isPendingTab && user?.permissions?.approve && (
      <>
        {project.status === 'Chờ duyệt' && !project.pendingEdit && !project.pendingDelete && (
          <>
            <div className="action-btn-wrapper" title="Duyệt mới"><button onClick={() => approveProject(project._id)} className="btn-icon btn-icon-green" disabled={isSubmittingAction}><FaCheckCircle size={18} /></button></div>
            <div className="action-btn-wrapper" title="Từ chối mới"><button onClick={() => rejectProject(project._id)} className="btn-icon btn-icon-orange" disabled={isSubmittingAction}><FaTimesCircle size={18} /></button></div>
          </>
        )}
        {project.pendingEdit && project.status === 'Đã duyệt' && (
          <>
            <div className="action-btn-wrapper" title="Xem & Duyệt sửa"><button onClick={() => openEditModal(project)} className="btn-icon btn-icon-teal" disabled={isSubmittingAction}><FaEdit size={16} /></button></div>
            <div className="action-btn-wrapper" title="Duyệt sửa"><button onClick={() => approveEditProject(project._id)} className="btn-icon btn-icon-blue" disabled={isSubmittingAction}><FaCheckCircle size={18} /></button></div>
            <div className="action-btn-wrapper" title="Từ chối sửa"><button onClick={() => rejectEditProject(project._id)} className="btn-icon btn-icon-yellow" disabled={isSubmittingAction}><FaTimesCircle size={18} /></button></div>
          </>
        )}
        {project.pendingDelete && project.status === 'Đã duyệt' && (
          <>
            <div className="action-btn-wrapper" title="Xem & Duyệt xóa"><button onClick={() => openEditModal(project)} className="btn-icon btn-icon-teal" disabled={isSubmittingAction}><FaEdit size={16} /></button></div>
            <div className="action-btn-wrapper" title="Duyệt xóa"><button onClick={() => approveDeleteProject(project._id)} className="btn-icon btn-icon-red" disabled={isSubmittingAction}><FaCheckCircle size={18} /></button></div>
            <div className="action-btn-wrapper" title="Từ chối xóa"><button onClick={() => rejectDeleteProject(project._id)} className="btn-icon btn-icon-gray" disabled={isSubmittingAction}><FaTimesCircle size={18} /></button></div>
          </>
        )}
      </>
    );

    const categorySpecificActions = isCategory && user?.permissions?.allocate && !isPendingTab && project.status === 'Đã duyệt' && !project.pendingEdit && !project.pendingDelete && (
      <div className="action-btn-wrapper flex items-center">
        <select value={allocateWaves[project._id] || ''} onChange={(e) => setAllocateWaves(prev => ({ ...prev, [project._id]: e.target.value }))} className="form-input text-xs py-0.5 px-1 w-20 mr-1" disabled={isSubmittingAction}>
          <option value="">Chọn đợt</option>
          {allocationWavesList.map((wave) => (<option key={wave._id || wave.name || wave} value={wave.name || wave}>{wave.name || wave}</option>))}
        </select>
        <button onClick={() => allocateProject(project._id)} className="btn-icon btn-icon-purple" disabled={isSubmittingAction || !allocateWaves[project._id]} title="Phân bổ"><FaWrench size={14} /></button>
      </div>
    );

    const assignAction = user?.permissions?.assign && !isPendingTab && (project.status === 'Đã duyệt' || project.status === 'allocated') && !project.pendingEdit && !project.pendingDelete && (
      <div className="action-btn-wrapper flex items-center">
        <input type="text" value={assignPersons[project._id] || ''} onChange={(e) => setAssignPersons(prev => ({ ...prev, [project._id]: e.target.value }))} placeholder="Người PT" className="form-input text-xs py-0.5 px-1 w-20 mr-1" disabled={isSubmittingAction} />
        <button onClick={() => assignProject(project._id)} className="btn-icon btn-icon-purple" disabled={isSubmittingAction || !assignPersons[project._id]} title="Giao việc"><FaUser size={14} /></button>
      </div>
    );

    return <div className="flex justify-center items-center gap-1.5">{commonEditButton}{commonDeleteButton}{pendingTabActionsContent}{categorySpecificActions}{assignAction}</div>;
  };

  return (
    <div className={`flex flex-col min-h-screen py-3 px-1 md:py-4 md:px-2 lg:py-5 lg:px-3 ${!showHeader ? 'pt-4' : 'pt-16 md:pt-8'} bg-gradient-to-b from-gray-50 to-gray-100`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-4">
        <h1 className="text-3xl font-bold text-gray-800 animate-slideIn">
          {isCategory ? 'Công trình Danh mục' : 'Công trình Sửa chữa nhỏ'}
        </h1>
        <div className="flex items-center gap-4">
          {user?.permissions?.add && (
            <button
              onClick={openAddNewModal}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || isLoading}
            >
              <FaPlus size={16} /> Thêm mới
            </button>
          )}
        </div>
      </div>

      {(isLoading || isSubmitting || isSubmittingAction) && ( // Thêm isSubmittingAction
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '24px',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            border: '1px solid #E5E7EB',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid #3B82F6',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}></div>
            <span style={{
              color: '#1F2937',
              fontSize: '18px',
              fontWeight: '600',
            }}>
              {isLoading ? 'Đang tải dữ liệu...' : 'Đang xử lý...'}
            </span>
          </div>
        </div>
      )}

      {showModal && formData && ( // Hiển thị modal khi showModal là true và formData đã được khởi tạo
        <GenericFormModal
          key={editProject ? `edit-${editProject._id}` : 'add-new-project'}
          showModal={showModal}
          setShowModal={setShowModal}
          isSubmitting={isSubmitting}
          editProject={editProject}
          formData={formData}
          setFormData={setFormData} // GenericFormModal sẽ tự gọi setFormData
          formConfig={currentFormConfig}
          saveProject={saveProject}
          initialFormState={initialFormData} // Hàm để reset form
          // Truyền tất cả các danh sách dữ liệu cần thiết cho dropdowns
          allocatedUnits={allocatedUnits}
          allocationWavesList={allocationWavesList}
          constructionUnitsList={constructionUnitsList}
          usersList={usersList}
          approversList={approversList}
          projectTypesList={projectTypesList}
        />
      )}

      <ProjectManagementTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isLoading={isLoading} // isLoading cho tab
        isSubmitting={isSubmitting || isSubmittingAction} // isSubmitting chung cho tab
      />

      {activeTab === 'projects' && (
        <>
          <div className="mb-3">
            <GenericFilter
                filterConfig={currentFilterConfig}
                filters={filters} // Truyền state filters đã gom nhóm
                setFilters={setFilters} // Truyền setter filters đã gom nhóm
                dataSources={{ // Truyền các danh sách dữ liệu cần thiết cho select
                  allocatedUnits,
                  constructionUnitsList,
                  allocationWavesList,
                  usersList,
                }}
                isLoading={isLoading || isSubmittingAction} // Sử dụng isSubmittingAction cho filter
                onResetFilters={handleResetFilters}
                showFilter={showFilter}
                setShowFilter={setShowFilter}
              />
          </div>

          <GenericTable
            data={filteredProjects}
            columns={currentTableColumns}
            user={user}
            usersList={usersList} // <<<< THÊM DÒNG NÀY
            isSubmitting={isSubmittingAction} // Sử dụng isSubmittingAction cho table
            isPendingTab={false} // Tab "projects" không phải là pending tab
            totalPages={totalPages}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            totalItemsCount={totalProjectsCount}
            itemsPerPage={itemsPerPage}
            isLoading={isLoading}
            tableWidth={isCategory ? '3400px' : '2150px'} // Có thể điều chỉnh hoặc lấy từ config
            renderActions={renderTableActions}
          />
        </>
      )}

      {activeTab === 'pending' && (
        <GenericTable
          data={pendingProjects}
          columns={currentTableColumns}
          user={user}
          usersList={usersList} // <<<< THÊM DÒNG NÀY
          isSubmitting={isSubmittingAction} // Sử dụng isSubmittingAction cho table
          isPendingTab={true} // Đây là pending tab
          totalPages={1} // Giả định tab pending không có phân trang server-side hoặc hiển thị tất cả
          currentPage={1}
          setCurrentPage={() => {}} // Không có phân trang cho tab này trong ví dụ
          totalItemsCount={pendingProjects.length}
          itemsPerPage={pendingProjects.length || itemsPerPage} // Hiển thị tất cả hoặc mặc định
          isLoading={isLoading}
          tableWidth={isCategory ? '3400px' : '2150px'}
          renderActions={renderTableActions}
        />
      )}

      {activeTab === 'rejected' && (
        <RejectedProjectTable
          rejectedProjects={rejectedProjects}
          isLoading={isLoading}
          user={user}
          type={type} // Để RejectedProjectTable có thể lọc theo type nếu cần
          restoreRejectedProject={restoreRejectedProject} // Truyền hàm mới
          permanentlyDeleteRejectedProject={permanentlyDeleteRejectedProject} // Truyền hàm mới
        />
      )}
    </div>
  );
}

export default ProjectManagement;
