// d:\CODE\water-company\frontend\src\components\ProjectManagement\ProjectManagement.js
import { FaPlus, FaFileExcel, FaDownload } from 'react-icons/fa';
import ProjectManagementLogic from './ProjectManagementLogic';
import ProjectManagementTabs from './ProjectManagementTabs';
import GenericFilter from './GenericFilter';
import { categoryFilterConfig, minorRepairFilterConfig, rejectedProjectFilterConfig } from '../../config/filterConfigs';
import GenericFormModal from './GenericFormModal';
import ExcelImportModal from './ExcelImportModal';
import GenericTable from './GenericTable';
import { categoryProjectColumns, minorRepairProjectColumns } from '../../config/tableConfigs';
import { formatDateToLocale } from '../../utils/dateUtils'; // Import formatDateToLocale
import { categoryFormConfig, minorRepairFormConfig } from '../../config/formConfigs';
import RejectedProjectTable from './RejectedProjectTable';
import ProjectTableActions from './ProjectTableActions'; // Import ProjectTableActions

function ProjectManagement({ user, type, showHeader, addMessage }) {
  const logicProps = ProjectManagementLogic({ user, type, showHeader, addMessage });
  const {
    // Data and State from useProjectData
    filteredProjects, pendingProjects, rejectedProjects,
    totalPages, totalProjectsCount,
    totalPagesPending, totalPendingCount,
    totalPagesRejected, totalRejectedCount, // Added for rejected tab
    currentPage, setCurrentPage, currentPageRejected, setCurrentPageRejected,
    filters, setFilters,
    allocatedUnits, constructionUnitsList, allocationWavesList,
    usersList, approversList, projectTypesList,
    isLoading, isFetching,
    handleResetFilters,
    // Actions and Modal State from useProjectActions
    showModal, setShowModal, formData, setFormData, editProject,
    openAddNewModal, openEditModal, saveProject, initialFormData, // Added initialFormData for GenericFormModal
    deleteProject, approveProject, rejectProject, // allocateProject, assignProject, // Removed
    approveEditProject, rejectEditProject, approveDeleteProject, rejectDeleteProject, // markProjectAsCompleted, moveProjectToNextYear sẽ được lấy trực tiếp từ logicProps
    restoreRejectedProject, permanentlyDeleteRejectedProject,
    showExcelImportModal, setShowExcelImportModal, excelImportData, excelImportHeaders, handleDownloadTemplate, handleFileImport, // setExcelImportData removed as unused
    submitExcelData, isImportingExcel, excelImportBackendErrors,
    isSubmitting, isSubmittingAction,
    // Local state from ProjectManagementLogic main function
    activeTab, setActiveTab,
    showFilter, setShowFilter,
  } = logicProps;

  const isCategory = type === 'category';
  const itemsPerPage = 10; // Or use itemsPerPageGlobal from logic

  const currentFormConfig = isCategory ? categoryFormConfig : minorRepairFormConfig;
  const currentFilterConfig = activeTab === 'rejected'
    ? rejectedProjectFilterConfig
    : (isCategory ? categoryFilterConfig : minorRepairFilterConfig);
  const currentTableColumns = isCategory ? categoryProjectColumns : minorRepairProjectColumns;

  const canUserPerformAction = (actionPermission, project = null) => {
    if (!user || !user.permissions) return false;
    if (user.role === 'admin') return true;
    if (!user.permissions[actionPermission]) return false;

    if (project && user.role.includes('-branch') && user.unit) {
      if (project.allocatedUnit !== user.unit && !user.permissions.viewOtherBranchProjects) {
        return false;
      }
    }
    return true;
  };

  const renderTableActionsComponent = (project, isPendingTabFlag) => (
    <ProjectTableActions
      project={project}
      user={user}
      isPendingTab={isPendingTabFlag}
      isSubmitting={isSubmittingAction}
      openEditModal={openEditModal}
      deleteProject={deleteProject}
      approveProject={approveProject}
      rejectProject={rejectProject}
      approveEditProject={approveEditProject}
      rejectEditProject={rejectEditProject}
      approveDeleteProject={approveDeleteProject}
      rejectDeleteProject={rejectDeleteProject}
      markProjectAsCompleted={logicProps.markProjectAsCompleted} // Lấy từ logicProps
      moveProjectToNextYear={logicProps.moveProjectToNextYear} // Lấy từ logicProps
      // allocateProject={allocateProject} // Removed
      // assignProject={assignProject} // Removed
      // allocateWaves={allocateWaves} // Removed
      // setAllocateWaves={setAllocateWaves} // Removed
      // allocationWavesList={allocationWavesList} // Removed
      // assignPersons={assignPersons} // Removed
      // setAssignPersons={setAssignPersons} // Removed
      isCategoryProject={isCategory}
    />
  );


  return (
    <div className={`flex flex-col min-h-screen py-3 px-1 md:py-4 md:px-2 lg:py-5 lg:px-3 ${!showHeader ? 'pt-4' : 'pt-16 md:pt-8'} bg-gradient-to-b from-gray-50 to-gray-100`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-4">
        <h1 className="text-3xl font-bold text-gray-800 animate-slideIn">
          {isCategory ? 'Công trình Danh mục' : 'Công trình Sửa chữa nhỏ'}
          {(isLoading || isFetching) && <span className="text-sm text-gray-500 ml-2">(Đang tải...)</span>}
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
            type="file" id="excel-upload" className="hidden"
            accept=".xlsx, .xls" onChange={handleFileImport}
            onClick={(event)=> { event.target.value = null }}
            disabled={isSubmitting || isLoading || isImportingExcel}
          />
          {canUserPerformAction('add') && (
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
              {isLoading ? 'Đang tải dữ liệu...' : (isImportingExcel ? 'Đang nhập Excel...' : 'Đang xử lý...')}
            </span>
          </div>
        </div>
      )}

      {showModal && formData && (
        <GenericFormModal
          key={editProject ? `edit-${editProject._id}` : 'add-new-project'}
          showModal={showModal} setShowModal={setShowModal}
          isSubmitting={isSubmitting} editProject={editProject}
          formData={formData} setFormData={setFormData}
          formConfig={currentFormConfig} saveProject={saveProject} // Pass initialFormData from logicProps
          initialFormState={initialFormData} // Pass the function itself directly
          allocatedUnits={allocatedUnits}
          allocationWavesList={allocationWavesList}
          constructionUnitsList={constructionUnitsList}
          usersList={usersList} approversList={approversList}
          projectTypesList={projectTypesList}
          user={user}
        />
      )}

      {showExcelImportModal && excelImportData && (
        <ExcelImportModal
          showModal={showExcelImportModal} setShowModal={setShowExcelImportModal}
          initialData={excelImportData} headersConfig={excelImportHeaders}
          projectType={type} user={user}
          dataSources={{
            allocatedUnits, constructionUnitsList, allocationWavesList,
            usersList, approversList, projectTypesList,
          }}
          onSubmit={submitExcelData} isSubmitting={isImportingExcel}
          backendValidationErrors={excelImportBackendErrors}
        />
      )}
      <ProjectManagementTabs
        activeTab={activeTab} setActiveTab={setActiveTab}
        isLoading={isLoading || isFetching} // Disable tabs when loading or fetching
        isSubmitting={isSubmitting || isSubmittingAction || isImportingExcel}
      />

      {(activeTab === 'projects' || activeTab === 'pending' || activeTab === 'rejected') && (
        <div className="mb-3">
          <GenericFilter
              filterConfig={currentFilterConfig}
              filters={filters} setFilters={setFilters}
              dataSources={{
                allocatedUnits, constructionUnitsList,
                allocationWavesList, usersList, projectTypesList, // Thêm projectTypesList
              }}
              isLoading={isLoading || isFetching || isSubmittingAction}
              onResetFilters={handleResetFilters}
              showFilter={showFilter} setShowFilter={setShowFilter}
            />
        </div>
      )}

      {activeTab === 'projects' && (
          <GenericTable
            data={filteredProjects} columns={currentTableColumns}
            user={user} usersList={usersList}
            isSubmitting={isSubmittingAction} isPendingTab={false}
            formatDateToLocale={formatDateToLocale} // Truyền hàm format date
            totalPages={totalPages} currentPage={currentPage} setCurrentPage={setCurrentPage}
            totalItemsCount={totalProjectsCount} itemsPerPage={itemsPerPage}
            isLoading={isLoading} isFetching={isFetching}
            tableWidth={isCategory ? '3500px' : '2300px'}
            renderActions={(project) => renderTableActionsComponent(project, false)}
          />
      )}

      {activeTab === 'pending' && (
          <GenericTable
            data={pendingProjects} columns={currentTableColumns}
            user={user} usersList={usersList}
            isSubmitting={isSubmittingAction} isPendingTab={true}
            formatDateToLocale={formatDateToLocale} // Truyền hàm format date
            totalPages={totalPagesPending} currentPage={currentPage} setCurrentPage={setCurrentPage}
            totalItemsCount={totalPendingCount} itemsPerPage={itemsPerPage}
            isLoading={isLoading} isFetching={isFetching}
            tableWidth={isCategory ? '3500px' : '2300px'}
            renderActions={(project) => renderTableActionsComponent(project, true)}
          />
      )}

      {activeTab === 'rejected' && (
        <RejectedProjectTable
          rejectedProjects={rejectedProjects}
          isLoading={isLoading || isFetching} user={user} type={type}
          restoreRejectedProject={restoreRejectedProject}
          permanentlyDeleteRejectedProject={permanentlyDeleteRejectedProject}
          currentPage={currentPageRejected} totalPages={totalPagesRejected}
          setCurrentPage={setCurrentPageRejected} totalItemsCount={totalRejectedCount}
          // Filters are now handled by GenericFilter above
        />
      )}
    </div>
  );
}

export default ProjectManagement;
