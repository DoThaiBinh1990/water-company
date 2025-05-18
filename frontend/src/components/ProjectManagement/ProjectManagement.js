// d:\CODE\water-company\frontend\src\components\ProjectManagement\ProjectManagement.js
import { FaPlus, FaEdit, FaTrash, FaCheckCircle, FaTimesCircle, FaWrench, FaUser, FaFileExcel, FaDownload } from 'react-icons/fa';
import ProjectManagementLogic from './ProjectManagementLogic';
import ProjectManagementTabs from './ProjectManagementTabs';
import GenericFilter from './GenericFilter';
import { categoryFilterConfig, minorRepairFilterConfig } from '../../config/filterConfigs';
import GenericFormModal from './GenericFormModal';
import ExcelImportModal from './ExcelImportModal'; // Sẽ tạo ở bước sau
import GenericTable from './GenericTable';
import { categoryProjectColumns, minorRepairProjectColumns } from '../../config/tableConfigs';
import { categoryFormConfig, minorRepairFormConfig } from '../../config/formConfigs';
import RejectedProjectTable from './RejectedProjectTable';

function ProjectManagement({ user, type, showHeader, addMessage }) {
  const logicProps = ProjectManagementLogic({ user, type, showHeader, addMessage });
  const {
    filteredProjects,
    pendingProjects,
    pendingProjectsData, // Thêm pendingProjectsData vào đây
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
  const {
    handleFileImport,
    handleDownloadTemplate,
    showExcelImportModal, setShowExcelImportModal, excelImportData, setExcelImportData,
    submitExcelData, isImportingExcel, excelImportHeaders
  } = logicProps; // Thêm các props mới từ logic

  const isCategory = type === 'category';
  const itemsPerPage = 10;
  const isPendingTab = activeTab === 'pending';

  const currentFormConfig = isCategory ? categoryFormConfig : minorRepairFormConfig;
  const currentFilterConfig = isCategory ? categoryFilterConfig : minorRepairFilterConfig;
  const currentTableColumns = isCategory ? categoryProjectColumns : minorRepairProjectColumns;

  const canUserPerformAction = (actionPermission, project = null) => {
    if (!user || !user.permissions) {
      return false;
    }

    // Admin có mọi quyền
    if (user.role === 'admin') return true;

    // Kiểm tra quyền cơ bản của user
    if (!user.permissions[actionPermission]) {
      return false;
    }

    // User thuộc khối văn phòng công ty (director, manager-office, staff-office)
    // Họ có thể thực hiện action nếu có quyền cơ bản (đã check ở trên)
    if (user.role.includes('director') || user.role.includes('office')) {
      return true;
    }

    // User thuộc chi nhánh (manager-branch, staff-branch)
    if (user.role.includes('-branch')) {
      // Nếu không có project cụ thể (ví dụ: nút "Thêm mới"), chỉ cần check quyền cơ bản (đã check)
      if (!project) return true; 
      
      // Nếu có project, phải thuộc chi nhánh của user
      if (!user.unit || project.allocatedUnit !== user.unit) {
        // Trừ khi họ có quyền xem/thao tác trên chi nhánh khác (cho manager)
        if (user.role === 'manager-branch' && user.permissions.viewOtherBranchProjects) {
            return true; // Manager có quyền viewOtherBranchProjects có thể thao tác nếu có actionPermission
        }
        return false; 
      }
      // Nếu công trình thuộc chi nhánh của họ, và họ có actionPermission -> cho phép
      return true; 
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
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-xl hover:bg-green-700 transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base w-full sm:w-auto"
            disabled={isSubmitting || isLoading || isImportingExcel}
          >
            <FaDownload size={14} /> Tải file mẫu
          </button>
          <label
            htmlFor="excel-upload"
            className={`flex items-center gap-2 bg-teal-600 text-white px-3 py-2 rounded-xl hover:bg-teal-700 transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-xl text-sm sm:text-base w-full sm:w-auto ${isSubmitting || isLoading || isImportingExcel ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <FaFileExcel size={14} /> Nhập từ Excel
          </label>
          <input
            type="file"
            id="excel-upload"
            className="hidden"
            accept=".xlsx, .xls"
            onChange={handleFileImport}
            onClick={(event)=> { event.target.value = null }} // Allow re-uploading the same file
            disabled={isSubmitting || isLoading || isImportingExcel}
          />
          {canUserPerformAction('add') && ( // Sử dụng canUserPerformAction cho nút Thêm mới
            <button
              onClick={openAddNewModal}
              className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-xl hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base w-full sm:w-auto"
              disabled={isSubmitting || isLoading}
            >
              <FaPlus size={16} /> Thêm mới
            </button>
          )}
        </div>
      </div>

      {(isLoading || isSubmitting || isSubmittingAction || isImportingExcel) && (
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

      {showExcelImportModal && excelImportData && (
        <ExcelImportModal
          showModal={showExcelImportModal}
          setShowModal={setShowExcelImportModal}
          initialData={excelImportData}
          headersConfig={excelImportHeaders} // Sẽ lấy từ logic
          projectType={type}
          user={user}
          dataSources={{
            allocatedUnits,
            constructionUnitsList,
            allocationWavesList,
            usersList,
            approversList,
            projectTypesList,
          }}
          onSubmit={submitExcelData}
          isSubmitting={isImportingExcel}
        />
      )}
      <ProjectManagementTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isLoading={isLoading}
        isSubmitting={isSubmitting || isSubmittingAction}
      />

      {(activeTab === 'projects' || activeTab === 'pending') && ( // Hiển thị filter cho cả tab projects và pending
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
        </>
      )}

      {activeTab === 'projects' && (
          <GenericTable
            data={filteredProjects}
            columns={currentTableColumns}
            user={user}
            usersList={usersList}
            isSubmitting={isSubmittingAction}
            isPendingTab={false}
            totalPages={totalPages}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            totalItemsCount={totalProjectsCount}
            itemsPerPage={itemsPerPage}
            isLoading={isLoading}
            tableWidth={isCategory ? '3500px' : '2300px'} // Điều chỉnh lại nếu cần
            renderActions={renderTableActions}
          />
      )}

      {activeTab === 'pending' && (
          <GenericTable
            data={pendingProjects}
            columns={currentTableColumns}
            user={user}
            usersList={usersList}
            isSubmitting={isSubmittingAction}
            isPendingTab={true}
            totalPages={pendingProjectsData?.pages || 1} // Sử dụng totalPages từ pendingProjectsData
            currentPage={currentPage} // Sử dụng currentPage chung
            setCurrentPage={setCurrentPage} // Cho phép phân trang
            totalItemsCount={pendingProjectsData?.total || 0} // Sử dụng total từ pendingProjectsData
            itemsPerPage={itemsPerPage}
            isLoading={isLoading}
            tableWidth={isCategory ? '3500px' : '2300px'} // Điều chỉnh lại nếu cần
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
