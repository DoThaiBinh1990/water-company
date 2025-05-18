// d:\CODE\water-company\frontend\src\components\ProjectManagement\ProjectManagement.js
import { FaPlus, FaEdit, FaTrash, FaCheckCircle, FaTimesCircle, FaWrench, FaUser } from 'react-icons/fa';
import ProjectManagementLogic from './ProjectManagementLogic';
import ProjectManagementTabs from './ProjectManagementTabs';
import GenericFilter from './GenericFilter';
import { categoryFilterConfig, minorRepairFilterConfig } from '../../config/filterConfigs';
import GenericFormModal from './GenericFormModal';
import GenericTable from './GenericTable';
import { categoryProjectColumns, minorRepairProjectColumns } from '../../config/tableConfigs';
import { categoryFormConfig, minorRepairFormConfig } from '../../config/formConfigs';
import RejectedProjectTable from './RejectedProjectTable';

function ProjectManagement({ user, type, showHeader, addMessage }) {
  const logicProps = ProjectManagementLogic({ user, type, showHeader, addMessage });
  const {
    filteredProjects,
    pendingProjects,
    rejectedProjects,
    totalPages,
    currentPage,
    setCurrentPage,
    sortOrder,
    // setSortOrder, // Không dùng trực tiếp ở đây, đã có handleSortChange
    showFilter,
    setShowFilter,
    totalProjectsCount,
    formData,
    setFormData,
    editProject,
    // setEditProject, // Không dùng trực tiếp
    // allocateWaves, // Không dùng trực tiếp
    // setAllocateWaves, // Không dùng trực tiếp
    // assignPersons, // Không dùng trực tiếp
    // setAssignPersons, // Không dùng trực tiếp
    filters,
    setFilters,
    allocatedUnits,
    constructionUnitsList,
    allocationWavesList,
    usersList,
    approversList,
    projectTypesList,
    showModal,
    setShowModal,
    isLoading,
    isSubmittingAction,
    isSubmitting,
    activeTab,
    setActiveTab,
    initialFormData,
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
    restoreRejectedProject,
    permanentlyDeleteRejectedProject,
  } = logicProps;

  const isCategory = type === 'category';
  const itemsPerPage = 10;
  const isPendingTab = activeTab === 'pending';

  const currentFormConfig = isCategory ? categoryFormConfig : minorRepairFormConfig;
  const currentFilterConfig = isCategory ? categoryFilterConfig : minorRepairFilterConfig;
  const currentTableColumns = isCategory ? categoryProjectColumns : minorRepairProjectColumns;

  const canUserPerformAction = (actionPermission, project = null) => {
    if (!user || !user.permissions || !user.permissions[actionPermission]) {
      return false;
    }
    // Admin và Quản lý công ty (không phải chi nhánh) có thể thực hiện trên mọi công trình
    if (user.role === 'admin' || user.role === 'director' || user.role === 'deputy_director' || user.role.includes('manager-office') || user.role === 'staff-office') {
      return true;
    }
    // Quản lý chi nhánh và Nhân viên chi nhánh
    if (user.role.includes('-branch')) {
      if (!project || !user.unit || project.allocatedUnit !== user.unit) { // Phải thuộc chi nhánh của user
        return false;
      }
      // Cả staff-branch và manager-branch đều có thể thao tác trên mọi công trình thuộc chi nhánh mình
      // if (user.role === 'staff-branch') { 
      //   return project.createdBy && project.createdBy._id === user._id; // Logic cũ: staff chỉ sửa/xóa của mình
      // }
      return true; // Logic mới: staff và manager chi nhánh thao tác trên mọi CT thuộc chi nhánh
    }
    return false; // Mặc định không cho phép
  };


  const renderTableActions = (project) => {
    const canEditThis = canUserPerformAction('edit', project);
    const canDeleteThis = canUserPerformAction('delete', project);
    const canApproveThis = user?.permissions?.approve; // Quyền duyệt chung
    // const canAllocateThis = user?.permissions?.allocate && isCategory && project.status === 'Đã duyệt' && !project.pendingEdit && !project.pendingDelete; // Bỏ nút allocate
    // const canAssignThis = user?.permissions?.assign && (project.status === 'Đã duyệt' || project.status === 'Đã phân bổ') && !project.pendingEdit && !project.pendingDelete; // Bỏ nút assign


    const editButton = canEditThis && !isPendingTab && (
      <div className="action-btn-wrapper" title={project.pendingEdit ? "YC sửa đang chờ" : project.pendingDelete ? "YC xóa đang chờ" : "Sửa/Xem"}>
        <button
          onClick={() => openEditModal(project)}
          className="btn-icon btn-icon-teal"
          disabled={isSubmittingAction || (project.pendingEdit && !canApproveThis) || (project.pendingDelete && !canApproveThis)}
        >
          <FaEdit size={16} />
        </button>
      </div>
    );

    const deleteButton = canDeleteThis && !isPendingTab && (
      <div className="action-btn-wrapper" title={project.pendingDelete ? "Đang chờ duyệt xóa" : "Xóa/Yêu cầu xóa"}>
        <button
          onClick={() => deleteProject(project._id)}
          className="btn-icon btn-icon-red"
          disabled={isSubmittingAction || (project.pendingDelete && !canApproveThis)}
        >
          <FaTrash size={16} />
        </button>
      </div>
    );

    const pendingTabActionsContent = isPendingTab && canApproveThis && (
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

    // return <div className="flex justify-center items-center gap-1.5">{editButton}{deleteButton}{pendingTabActionsContent}{allocateActionContent}{assignActionContent}</div>;
    return <div className="flex justify-center items-center gap-1.5">{editButton}{deleteButton}{pendingTabActionsContent}</div>;
  };


  return (
    <div className={`flex flex-col min-h-screen py-3 px-1 md:py-4 md:px-2 lg:py-5 lg:px-3 ${!showHeader ? 'pt-4' : 'pt-16 md:pt-8'} bg-gradient-to-b from-gray-50 to-gray-100`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-4">
        <h1 className="text-3xl font-bold text-gray-800 animate-slideIn">
          {isCategory ? 'Công trình Danh mục' : 'Công trình Sửa chữa nhỏ'} {isLoading && <span className="text-sm text-gray-500">(Đang tải...)</span>}
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

      {(isLoading || isSubmitting || isSubmittingAction) && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, backdropFilter: 'blur(4px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', border: '1px solid #E5E7EB' }}>
            <div style={{ width: '40px', height: '40px', border: '4px solid #3B82F6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <span style={{ color: '#1F2937', fontSize: '18px', fontWeight: '600' }}>
              {isLoading ? 'Đang tải dữ liệu...' : 'Đang xử lý...'}
            </span>
          </div>
        </div>
      )}

      {showModal && formData && (
        <GenericFormModal
          key={editProject ? `edit-${editProject._id}` : 'add-new-project'}
          showModal={showModal}
          setShowModal={setShowModal}
          isSubmitting={isSubmitting}
          editProject={editProject}
          formData={formData}
          setFormData={setFormData}
          formConfig={currentFormConfig}
          saveProject={saveProject}
          initialFormState={initialFormData}
          allocatedUnits={allocatedUnits}
          allocationWavesList={allocationWavesList}
          constructionUnitsList={constructionUnitsList}
          usersList={usersList} // Danh sách tất cả user cho các mục chọn chung
          approversList={approversList} // Danh sách user có quyền approve
          projectTypesList={projectTypesList}
          user={user} // Truyền user vào modal
        />
      )}

      <ProjectManagementTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isLoading={isLoading}
        isSubmitting={isSubmitting || isSubmittingAction}
      />

      {activeTab === 'projects' && (
        <>
          <div className="mb-3">
            <GenericFilter
                filterConfig={currentFilterConfig}
                filters={filters}
                setFilters={setFilters}
                dataSources={{
                  allocatedUnits,
                  constructionUnitsList,
                  allocationWavesList,
                  usersList, // Truyền usersList cho filter
                }}
                isLoading={isLoading || isSubmittingAction}
                onResetFilters={handleResetFilters}
                showFilter={showFilter}
                setShowFilter={setShowFilter}
              />
          </div>

          <GenericTable
            data={filteredProjects}
            columns={currentTableColumns}
            user={user}
            usersList={usersList} // Truyền usersList xuống GenericTable
            isSubmitting={isSubmittingAction}
            isPendingTab={false}
            totalPages={totalPages}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            totalItemsCount={totalProjectsCount}
            itemsPerPage={itemsPerPage}
            isLoading={isLoading}
            tableWidth={isCategory ? '3400px' : '2150px'}
            renderActions={renderTableActions}
          />
        </>
      )}

      {activeTab === 'pending' && (
        <GenericTable
          data={pendingProjects}
          columns={currentTableColumns}
          user={user}
          usersList={usersList} // Truyền usersList xuống GenericTable
          isSubmitting={isSubmittingAction}
          isPendingTab={true}
          totalPages={1}
          currentPage={1}
          setCurrentPage={() => {}}
          totalItemsCount={pendingProjects.length}
          itemsPerPage={pendingProjects.length || itemsPerPage}
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
          type={type}
          restoreRejectedProject={restoreRejectedProject}
          permanentlyDeleteRejectedProject={permanentlyDeleteRejectedProject}
        />
      )}
    </div>
  );
}

export default ProjectManagement;
