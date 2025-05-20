// d:\CODE\water-company\frontend\src\components\ProjectManagement\ProjectManagementLogic.js
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import io from 'socket.io-client';
import { toast } from 'react-toastify';
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject as deleteProjectAPI,
  approveProject as approveProjectAPI, // Renamed to avoid conflict
  rejectProject as rejectProjectAPI,   // Renamed to avoid conflict
  // allocateProject as allocateProjectAPI, // Removed
  // assignProject as assignProjectAPI,     // Removed
  getRejectedProjects,
  restoreRejectedProject as restoreRejectedProjectAPI,
  permanentlyDeleteRejectedProject as permanentlyDeleteRejectedProjectAPI,
  getAllocatedUnits, getAllocationWaves, getConstructionUnits, getUsers, getProjectTypes,
  apiClient,
  importProjects as importProjectsAPI,
  markProjectAsCompletedAPI, // Thêm API mới
  moveProjectToNextFinancialYearAPI, // Thêm API mới
} from '../../apiService';
import { generateExcelTemplate, readExcelData } from '../../utils/excelHelper';

const socket = io(apiClient.defaults.baseURL, {
  transports: ['websocket', 'polling'],
  withCredentials: true,
  autoConnect: false,
});

const itemsPerPageGlobal = 10; // Define once globally for the module

// Custom hook for fetching project data
const useProjectData = (user, type, activeTab, itemsPerPage = itemsPerPageGlobal) => {
  const queryClient = useQueryClient(); // Get queryClient instance
  const isCategory = type === 'category';
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState('serial_asc'); // Default sort
  const [currentPageRejected, setCurrentPageRejected] = useState(1);

  const initialFilters = useMemo(() => ({
    financialYear: new Date().getFullYear(), // Mặc định là năm hiện tại
    isCompleted: false, // Mặc định xem công trình chưa hoàn thành
    status: '', allocatedUnit: '', constructionUnit: '', name: '',
    minInitialValue: '', maxInitialValue: '', progress: '',
    allocationWave: '', supervisor: '', estimator: '', reportDate: '', assignedTo: '',    
    projectType: '', // Added projectType filter for category projects    
    requestedBy: '', // Thêm bộ lọc người yêu cầu cho tab rejected
    rejectedBy: '', // Thêm bộ lọc người từ chối cho tab rejected
  }), []);
  const [filters, setFilters] = useState(initialFilters);

  const buildProjectQueryParams = useCallback((page, currentSortOrder, currentFilters, isPending) => {
    const params = { type, page, limit: itemsPerPage };
    const activeApiFilters = {};

    if (currentFilters.financialYear) activeApiFilters.financialYear = currentFilters.financialYear;
    // Gửi isCompleted.
    activeApiFilters.isCompleted = currentFilters.isCompleted === true || String(currentFilters.isCompleted).toLowerCase() === 'true';
    if (currentFilters.status) activeApiFilters.status = currentFilters.status;
    if (currentFilters.allocatedUnit) activeApiFilters.allocatedUnit = currentFilters.allocatedUnit;
    if (isCategory && currentFilters.constructionUnit) activeApiFilters.constructionUnit = currentFilters.constructionUnit;
    if (isCategory && currentFilters.projectType) activeApiFilters.projectType = currentFilters.projectType; // Add projectType filter for category
    if (currentFilters.name) activeApiFilters.search = currentFilters.name; // 'search' for name
    if (isCategory && currentFilters.minInitialValue) activeApiFilters.minInitialValue = currentFilters.minInitialValue;
    if (isCategory && currentFilters.maxInitialValue) activeApiFilters.maxInitialValue = currentFilters.maxInitialValue;
    if (isCategory && currentFilters.progress) activeApiFilters.progress = currentFilters.progress;
    if (isCategory && currentFilters.allocationWave) activeApiFilters.allocationWave = currentFilters.allocationWave;
    if (currentFilters.supervisor) activeApiFilters.supervisor = currentFilters.supervisor;
    if (isCategory && currentFilters.estimator) activeApiFilters.estimator = currentFilters.estimator;
    if (currentFilters.assignedTo) activeApiFilters.assignedTo = currentFilters.assignedTo;
    if (!isCategory && currentFilters.reportDate) activeApiFilters.reportDate = currentFilters.reportDate;

    Object.assign(params, activeApiFilters);

    if (currentSortOrder === 'serial_asc') {
      params.sort = isCategory ? 'categorySerialNumber' : 'minorRepairSerialNumber';
      params.order = 'asc';
    } else if (currentSortOrder === 'created_desc') {
      params.sort = 'createdAt';
      params.order = 'desc';
    }
    if (isPending) {
      params.pending = 'true';
    }
    return params; // Return the constructed params object
  }, [type, isCategory, itemsPerPage]);

  const { data: projectsData, isLoading: isLoadingProjects, isFetching: isFetchingProjects, refetch: refetchProjects } = useQuery({
    queryKey: ['projects', type, currentPage, sortOrder, filters],
    queryFn: () => getProjects(buildProjectQueryParams(currentPage, sortOrder, filters, false)),
    enabled: !!user && activeTab === 'projects',
    keepPreviousData: true,
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi tải danh sách công trình!', { position: "top-center" }),
  });

  const { data: pendingProjectsData, isLoading: isLoadingPending, isFetching: isFetchingPending, refetch: refetchPendingProjects } = useQuery({
    queryKey: ['pendingProjects', type, currentPage, sortOrder, filters],
    queryFn: () => getProjects(buildProjectQueryParams(currentPage, sortOrder, filters, true)),
    enabled: !!user && activeTab === 'pending',
    keepPreviousData: true,
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi tải danh sách chờ duyệt!', { position: "top-center" }),
  });

  const buildRejectedProjectQueryParams = useCallback((page, currentFilters) => {
    const params = { type, page, limit: itemsPerPage };
    if (currentFilters.name) params.search = currentFilters.name; // Assuming backend supports 'search' for name on rejected
    if (currentFilters.financialYear) params.financialYear = currentFilters.financialYear; // Thêm financialYear cho rejected
    // Không cần isCompleted cho rejected
    if (currentFilters.allocatedUnit) params.allocatedUnit = currentFilters.allocatedUnit;
    if (currentFilters.requestedBy) params.requestedBy = currentFilters.requestedBy;
    if (currentFilters.rejectedBy) params.rejectedBy = currentFilters.rejectedBy;
    return params;
  });

  const { data: rejectedProjectsData, isLoading: isLoadingRejected, isFetching: isFetchingRejected, refetch: refetchRejectedProjects } = useQuery({ // Use useCallback for buildRejectedProjectQueryParams
    queryKey: ['rejectedProjects', type, currentPageRejected, filters], // Include filters for rejected
    queryFn: () => getRejectedProjects(buildRejectedProjectQueryParams(currentPageRejected, filters)),
    enabled: !!user && activeTab === 'rejected',
    keepPreviousData: true,
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi tải danh sách bị từ chối!', { position: "top-center" }),
  });

  const { data: allocatedUnitsData = [] } = useQuery({
    queryKey: ['allocatedUnits'], queryFn: getAllocatedUnits, enabled: !!user,
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi tải đơn vị!', { position: "top-center" }),
  });
  const { data: allocationWavesListData = [] } = useQuery({
    queryKey: ['allocationWaves'], queryFn: getAllocationWaves, enabled: !!user,
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi tải đợt phân bổ!', { position: "top-center" }),
  });
  const { data: constructionUnitsListData = [] } = useQuery({
    queryKey: ['constructionUnits'], queryFn: getConstructionUnits, enabled: !!user,
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi tải đơn vị thi công!', { position: "top-center" }),
  });
  const { data: usersData = [] } = useQuery({
    queryKey: ['users'], queryFn: getUsers, enabled: !!user,
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi tải danh sách người dùng!', { position: "top-center" }),
  });
  const { data: projectTypesListData = [] } = useQuery({
    queryKey: ['projectTypes'], queryFn: getProjectTypes, enabled: !!user,
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi tải loại công trình!', { position: "top-center" }),
  });

  const allocatedUnits = useMemo(() => allocatedUnitsData.map(unit => typeof unit === 'object' && unit.name ? unit.name : String(unit)), [allocatedUnitsData]);
  const allocationWavesList = useMemo(() => allocationWavesListData.map(wave => wave.name || String(wave)), [allocationWavesListData]);
  const constructionUnitsList = useMemo(() => constructionUnitsListData.map(unit => typeof unit === 'object' && unit.name ? unit.name : String(unit)), [constructionUnitsListData]);
  const usersList = useMemo(() => usersData.map(u => ({ _id: u._id, fullName: u.fullName || u.username })), [usersData]); // Ensure fullName or username is used for label
  const approversList = useMemo(() => usersData.filter(u => u.permissions?.approve), [usersData]);
  const projectTypesList = useMemo(() => projectTypesListData.map(pt => pt.name || String(pt)), [projectTypesListData]);
  
  const isLoading = isLoadingProjects || isLoadingPending || isLoadingRejected;
  const isFetching = isFetchingProjects || isFetchingPending || isFetchingRejected;

  const handleSortChange = useCallback((e) => {
    setSortOrder(e.target.value);
    setCurrentPage(1); // Reset page on sort change for main/pending
    if (activeTab === 'rejected') setCurrentPageRejected(1);
  }, [activeTab, setSortOrder, setCurrentPage, setCurrentPageRejected]);

  const handleResetFilters = useCallback(() => {
    setFilters(initialFilters);
    setCurrentPage(1);
    if (activeTab === 'rejected') setCurrentPageRejected(1);
  }, [initialFilters, activeTab]);

  // Socket listeners for real-time updates
  useEffect(() => {
    const invalidateProjectQueries = () => {
      queryClient.invalidateQueries(['projects', type]);
      queryClient.invalidateQueries(['pendingProjects', type]);
    };
    const invalidateAllProjectRelatedQueries = () => {
      invalidateProjectQueries();
      queryClient.invalidateQueries(['rejectedProjects', type]);
    };

    if (user) {
      if (!socket.connected) socket.connect();
      socket.on('project_deleted', ({ projectType: eventProjectType }) => { if (eventProjectType === type) invalidateAllProjectRelatedQueries(); });
      socket.on('project_rejected_and_removed', ({ projectType: eventProjectType }) => { if (eventProjectType === type) invalidateAllProjectRelatedQueries(); });
      socket.on('notification_processed', () => invalidateProjectQueries()); // Could be more specific
      socket.on('project_updated', ({ projectType: eventProjectType }) => { if (eventProjectType === type) invalidateProjectQueries(); });
      socket.on('project_approved', ({ projectType: eventProjectType }) => { if (eventProjectType === type) invalidateProjectQueries(); });
      socket.on('project_allocated', ({ projectType: eventProjectType }) => { if (eventProjectType === type) invalidateProjectQueries(); });
      socket.on('project_assigned', ({ projectType: eventProjectType }) => { if (eventProjectType === type) invalidateProjectQueries(); });
      socket.on('project_rejected_restored', ({ projectType: eventProjectType }) => { if (eventProjectType === type) invalidateAllProjectRelatedQueries(); });
      socket.on('project_rejected_permanently_deleted', ({ projectType: eventProjectType }) => { if (eventProjectType === type) queryClient.invalidateQueries(['rejectedProjects', type]); });

      return () => {
        socket.off('project_deleted');
        socket.off('project_rejected_and_removed');
        socket.off('notification_processed');
        socket.off('project_updated');
        socket.off('project_approved');
        socket.off('project_allocated');
        socket.off('project_assigned');
        socket.off('project_rejected_restored');
        socket.off('project_rejected_permanently_deleted');
      };
    }
  }, [user, type, queryClient]);


  return {
    projectsData, pendingProjectsData, rejectedProjectsData,
    isLoading, isFetching,
    currentPage, setCurrentPage, currentPageRejected, setCurrentPageRejected,
    sortOrder, setSortOrder, filters, setFilters, initialFilters,
    allocatedUnits, allocationWavesList, constructionUnitsList, usersList, approversList, projectTypesList,
    handleSortChange, handleResetFilters,
    refetchProjects, refetchPendingProjects, refetchRejectedProjects,
  };
};

// Custom hook for project mutations and form/modal logic
const useProjectActions = (user, type, queryClient, addMessage) => {
  const isCategory = type === 'category';
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(null);
  const [editProject, setEditProject] = useState(null);
  // const [allocateWaves, setAllocateWaves] = useState({}); // Removed
  // const [assignPersons, setAssignPersons] = useState({}); // Removed

  const [showExcelImportModal, setShowExcelImportModal] = useState(false);
  const [excelImportData, setExcelImportData] = useState(null);
  const [excelImportHeaders, setExcelImportHeaders] = useState([]);
  const [excelImportBackendErrors, setExcelImportBackendErrors] = useState(null);


  const initialFormData = useCallback(() => {
    const baseState = {
      name: '', allocatedUnit: '', supervisor: '', taskDescription: '', notes: '',
      approvedBy: '', createdBy: user?._id || '',
      financialYear: new Date().getFullYear(), // Mặc định năm tài chính
    };
    if (isCategory) {
      return {
        ...baseState, constructionUnit: '', allocationWave: '', location: '', scale: '',
        initialValue: '', estimator: '', durationDays: '', startDate: '', completionDate: '',
        contractValue: '', progress: '', feasibility: '', projectType: '', estimatedValue: '',
        leadershipApproval: '',
      };
    } else {
      return {
        ...baseState, reportDate: '', inspectionDate: '', paymentDate: '', paymentValue: '',
        location: '', scale: '', leadershipApproval: '',
      };
    }
  }, [isCategory, user]);

  useEffect(() => {
    setFormData(initialFormData());
  }, [initialFormData]);

  const openAddNewModal = useCallback(() => {
    setEditProject(null);
    setFormData(initialFormData());
    setShowModal(true);
  }, [setEditProject, setFormData, setShowModal, initialFormData]); // Theo gợi ý ESLint, nhưng cẩn thận nếu initialFormData thay đổi

  const openEditModal = useCallback((project) => {
    setEditProject(project);
    const formatForInput = (dateStr) => dateStr ? new Date(dateStr).toISOString().split('T')[0] : '';
    // Helper để lấy ID người dùng, xử lý cả trường hợp là object hoặc string ID
    const getUserId = (userData) => {
      if (userData && typeof userData === 'object' && userData._id) return userData._id;
      if (typeof userData === 'string' && userData.match(/^[0-9a-fA-F]{24}$/)) return userData; // Check if it's a valid ObjectId string
      if (typeof userData === 'string') return userData; // Could be a username/name if not an ID
      return '';
    };

    const baseData = {
      name: project.name || '', allocatedUnit: project.allocatedUnit || '',
      supervisor: getUserId(project.supervisor), taskDescription: project.taskDescription || '',
      notes: project.notes || '', approvedBy: getUserId(project.approvedBy),
      createdBy: getUserId(project.createdBy) || user?._id || '',
      financialYear: project.financialYear || new Date().getFullYear(), // Lấy financialYear
    };

    let projectDataToSet = {};
    if (isCategory) {
      projectDataToSet = {
        ...baseData, constructionUnit: project.constructionUnit || '',
        allocationWave: project.allocationWave || '', location: project.location || '',
        scale: project.scale || '', initialValue: project.initialValue ?? '',
        estimator: getUserId(project.estimator), durationDays: project.durationDays ?? '',
        startDate: formatForInput(project.startDate), completionDate: formatForInput(project.completionDate),
        contractValue: project.contractValue ?? '', progress: project.progress || '',
        feasibility: project.feasibility || '', projectType: project.projectType || '',
        estimatedValue: project.estimatedValue ?? '', leadershipApproval: project.leadershipApproval || '',
      };
    } else {
      projectDataToSet = {
        ...baseData, reportDate: formatForInput(project.reportDate),
        inspectionDate: formatForInput(project.inspectionDate), // Đảm bảo định dạng YYYY-MM-DD
        paymentDate: formatForInput(project.paymentDate), // Đảm bảo định dạng YYYY-MM-DD
        paymentValue: project.paymentValue ?? '', location: project.location || '', scale: project.scale || '',
        leadershipApproval: project.leadershipApproval || '',
      };
    }
    setFormData(projectDataToSet);
    setShowModal(true);
  }, [isCategory, user, initialFormData]);

  const saveProjectMutation = useMutation({
    mutationFn: async (projectPayload) => {
      const payload = { ...projectPayload, type };
      const numericFieldsCategory = ['initialValue', 'durationDays', 'contractValue', 'estimatedValue'];
      const numericFieldsMinor = ['paymentValue'];
      const fieldsToParse = isCategory ? numericFieldsCategory : numericFieldsMinor;
      if (payload.financialYear) payload.financialYear = parseInt(payload.financialYear, 10);

      fieldsToParse.forEach((field) => {
        const value = payload[field];
        payload[field] = (value === '' || value === null || value === undefined || isNaN(parseFloat(value))) ? null : parseFloat(value);
      });
      if (payload.durationDays !== null && payload.durationDays !== undefined) {
        payload.durationDays = parseInt(payload.durationDays, 10) || null;
      }

      const fieldsToRemove = isCategory
        ? ['reportDate', 'inspectionDate', 'paymentDate', 'paymentValue']
        : ['constructionUnit', 'allocationWave', 'estimator', 'durationDays', 'startDate', 'completionDate', 'contractValue', 'progress', 'feasibility', 'projectType', 'estimatedValue'];
      fieldsToRemove.forEach(field => delete payload[field]);

      if (payload.supervisor === '') payload.supervisor = null;
      if (isCategory && payload.estimator === '') payload.estimator = null;

      return editProject ? updateProject({ projectId: editProject._id, type, data: payload }) : createProject(payload);
    },
    onSuccess: (data) => {
      let successMessage = data.message || (editProject ? 'Đã cập nhật công trình!' : 'Đã đăng ký công trình!');
      if (data?.project?.pendingEdit || (!editProject && data?.project?.status === 'Chờ duyệt')) {
        successMessage += ' Công trình đang ở trạng thái "Chờ duyệt".';
      }
      addMessage(successMessage, 'success');
      setFormData(initialFormData());
      queryClient.invalidateQueries(['projects', type]);
      queryClient.invalidateQueries(['pendingProjects', type]);
      setShowModal(false);
    },
    onError: (err) => addMessage(err.response?.data?.message || 'Lỗi khi lưu công trình!', 'error'),
  });

  const saveProject = useCallback(() => {
    if (isCategory) {
      if (!formData.name || !formData.allocatedUnit || !formData.projectType || !formData.scale || !formData.location || !formData.approvedBy || !formData.financialYear) {
        addMessage('Vui lòng nhập đầy đủ các trường bắt buộc: Tên, Đơn vị PB, Loại CT, Quy mô, Địa điểm, Người duyệt, Năm tài chính!', 'error'); return;
      }
    } else {
      if (!formData.name || !formData.allocatedUnit || !formData.location || !formData.scale || !formData.reportDate || !formData.approvedBy || !formData.financialYear) {
        addMessage('Vui lòng nhập đầy đủ các trường bắt buộc: Tên, Đơn vị PB, Địa điểm, Quy mô, Ngày SC, Người duyệt, Năm tài chính!', 'error'); return;
      }
    }
    saveProjectMutation.mutate(formData);
  }, [saveProjectMutation, formData, isCategory, addMessage]);

  const useGenericActionMutation = (mutationFn, { successMsg, invalidateRejected = false } = {}) => {
    return useMutation({
      mutationFn,
      onSuccess: (data) => {
        addMessage(data.message || successMsg || "Thao tác thành công!", 'success');
        queryClient.invalidateQueries(['projects', type]);
        queryClient.invalidateQueries(['pendingProjects', type]);
        if (invalidateRejected) queryClient.invalidateQueries(['rejectedProjects', type]);
      },
      onError: (err) => addMessage(err.response?.data?.message || 'Thao tác thất bại!', 'error'),
    });
  };

  const handleActionWithConfirm = useCallback((mutation, variables, confirmMessage = "Bạn có chắc chắn?") => {
    if (window.confirm(confirmMessage)) {
      mutation.mutate(variables);
    }
  }, []);

  const deleteProjectMutation = useGenericActionMutation(deleteProjectAPI, { successMsg: 'Yêu cầu xóa/xóa công trình đã được xử lý.'});
  const deleteProject = (id) => handleActionWithConfirm(deleteProjectMutation, { projectId: id, type }, "Xác nhận Xóa hoặc gửi Yêu cầu xóa công trình này?");

  const approveProjectMutation = useGenericActionMutation(approveProjectAPI, { successMsg: 'Công trình đã được duyệt.' });
  const approveProject = (id) => handleActionWithConfirm(approveProjectMutation, { projectId: id, type }, "Xác nhận DUYỆT công trình này?");

  const rejectProjectMutation = useGenericActionMutation(rejectProjectAPI, { successMsg: 'Công trình đã bị từ chối.' });
  const rejectProject = (id) => {
    const reason = prompt("Vui lòng nhập lý do từ chối:");
    if (reason === null) return;
    if (!reason || reason.trim() === "") { addMessage("Lý do từ chối không được để trống.", 'error'); return; }
    handleActionWithConfirm(rejectProjectMutation, { projectId: id, type, reason }, "Xác nhận TỪ CHỐI công trình này?");
  };
  // Removed allocateProject and assignProject
  // const allocateProjectMutation = useGenericActionMutation(allocateProjectAPI);
  // const allocateProject = (id) => {
  //   const constructionUnit = prompt("Nhập đơn vị thi công:");
  //   if (constructionUnit === null) return;
  //   if (!constructionUnit || constructionUnit.trim() === "") { addMessage("Đơn vị thi công không được để trống.", 'error'); return; }
  //   const allocationWave = prompt("Nhập đợt phân bổ:");
  //   if (allocationWave === null) return;
  //   if (!allocationWave || allocationWave.trim() === "") { addMessage("Đợt phân bổ không được để trống.", 'error'); return; }
  //   handleActionWithConfirm(allocateProjectMutation, { projectId: id, type, constructionUnit: constructionUnit.trim(), allocationWave: allocationWave.trim() }, `Phân bổ cho ĐVTC "${constructionUnit.trim()}" (Đợt: "${allocationWave.trim()}")?`);
  // };

  // const assignProjectMutation = useGenericActionMutation(assignProjectAPI);
  // const assignProject = (id) => {
  //   const supervisor = prompt("Nhập ID người giám sát:");
  //   if (supervisor === null) return;
  //   if (!supervisor || supervisor.trim() === "") { addMessage("ID người giám sát không được để trống.", 'error'); return; }
  //   let estimator = null;
  //   if (isCategory) {
  //     estimator = prompt("Nhập ID người dự toán (nếu có):");
  //     if (estimator === null) return;
  //   }
  //   const payload = { supervisor: supervisor.trim() };
  //   if (isCategory && estimator && estimator.trim() !== "") payload.estimator = estimator.trim();
  //   handleActionWithConfirm(assignProjectMutation, { projectId: id, type, ...payload }, `Giao việc cho Giám sát ID: "${supervisor.trim()}"` + (isCategory && estimator && estimator.trim() ? ` và Dự toán ID: "${estimator.trim()}"` : "") + "?");
  // };

  const approveEditProject = (id) => handleActionWithConfirm(approveProjectMutation, { projectId: id, type }, "Xác nhận DUYỆT yêu cầu sửa công trình này?");
  const rejectEditProject = (id) => {
    const reason = prompt("Vui lòng nhập lý do từ chối yêu cầu sửa:");
    if (reason === null) return;
    if (!reason || reason.trim() === "") { addMessage("Lý do từ chối không được để trống.", 'error'); return; }
    handleActionWithConfirm(rejectProjectMutation, { projectId: id, type, reason }, "Xác nhận TỪ CHỐI yêu cầu sửa công trình này?");
  };
  const approveDeleteProject = (id) => handleActionWithConfirm(approveProjectMutation, { projectId: id, type }, "Xác nhận DUYỆT yêu cầu xóa công trình này?");
  const rejectDeleteProject = (id) => {
    const reason = prompt("Vui lòng nhập lý do từ chối yêu cầu xóa:");
    if (reason === null) return;
    if (!reason || reason.trim() === "") { addMessage("Lý do từ chối không được để trống.", 'error'); return; }
    handleActionWithConfirm(rejectProjectMutation, { projectId: id, type, reason }, "Xác nhận TỪ CHỐI yêu cầu xóa công trình này?");
  };

  const restoreRejectedProjectMutation = useGenericActionMutation(restoreRejectedProjectAPI, { successMsg: 'Công trình đã được khôi phục và duyệt!', invalidateRejected: true });
  const restoreRejectedProject = (rejectedId) => {
    if (window.confirm('Bạn có chắc chắn muốn khôi phục công trình này? Công trình sẽ được duyệt và chuyển vào danh sách chính.')) {
      restoreRejectedProjectMutation.mutate({ rejectedId }); // Pass an object
    }
  };

  const permanentlyDeleteRejectedProjectMutation = useGenericActionMutation(permanentlyDeleteRejectedProjectAPI, { successMsg: 'Công trình bị từ chối đã được xóa vĩnh viễn.', invalidateRejected: true });
  const permanentlyDeleteRejectedProject = (rejectedId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn công trình bị từ chối này? Hành động này không thể hoàn tác.')) return;
    permanentlyDeleteRejectedProjectMutation.mutate(rejectedId);
  };

  // Mutations for new actions
  const markAsCompletedMutation = useGenericActionMutation(markProjectAsCompletedAPI, { successMsg: 'Công trình đã được đánh dấu hoàn thành.' });
  const markProjectAsCompleted = (id) => handleActionWithConfirm(markAsCompletedMutation, { projectId: id, type }, "Xác nhận ĐÁNH DẤU HOÀN THÀNH công trình này?");

  const moveToNextYearMutation = useGenericActionMutation(moveProjectToNextFinancialYearAPI, { successMsg: 'Công trình đã được chuyển sang năm tài chính tiếp theo.' });
  const moveProjectToNextYear = (id) => handleActionWithConfirm(moveToNextYearMutation, { projectId: id, type }, "Xác nhận CHUYỂN CÔNG TRÌNH sang năm tài chính tiếp theo?");

  const handleDownloadTemplate = useCallback(() => {
    try {
      generateExcelTemplate(type);
      addMessage("Đã tải file mẫu Excel!", 'success');
    } catch (error) {
      addMessage("Lỗi khi tạo file mẫu Excel.", 'error');
      console.error("Error generating Excel template:", error);
    }
  }, [type, addMessage]);

  const handleFileImport = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/)) {
      addMessage("Vui lòng chọn file Excel (.xlsx hoặc .xls).", 'error'); return;
    }
    try {
      const { jsonData, headerRow } = await readExcelData(file);
      if (!jsonData || jsonData.length === 0) {
        addMessage("File Excel rỗng hoặc không có dữ liệu.", 'warn'); return;
      }
      setExcelImportHeaders(headerRow);
      setExcelImportData(jsonData);
      setShowExcelImportModal(true);
      setExcelImportBackendErrors(null); // Clear previous backend errors
    } catch (error) {
      addMessage(error.message || "Lỗi khi đọc file Excel.", 'error');
      console.error("Error processing Excel file:", error);
    }
  }, [addMessage]);

  const importProjectsMutation = useMutation({
    mutationFn: (projectsToImport) => importProjectsAPI({ projects: projectsToImport, projectType: type }),
    onSuccess: (data) => {
      addMessage(data.message || "Tất cả công trình đã được nhập thành công!", 'success');
      queryClient.invalidateQueries(['projects', type]);
      queryClient.invalidateQueries(['pendingProjects', type]);
      setShowExcelImportModal(false);
      setExcelImportData(null);
      setExcelImportHeaders([]);
      setExcelImportBackendErrors(null);
    },
    onError: (error) => {
      const errorData = error.response?.data;
      if (errorData && errorData.results && Array.isArray(errorData.results)) {
        addMessage(errorData.message || "Có lỗi trong dữ liệu Excel. Vui lòng kiểm tra lại bảng.", 'error');
        setExcelImportBackendErrors(errorData.results); // Set backend errors for modal
      } else {
        addMessage(error.response?.data?.message || "Lỗi không xác định khi nhập công trình từ Excel!", 'error');
      }
    }
  });
  const submitExcelData = useCallback((processedData) => importProjectsMutation.mutate(processedData), [importProjectsMutation]);

  return {
    showModal, setShowModal, formData, setFormData, editProject, setEditProject,
    // allocateWaves, setAllocateWaves, assignPersons, setAssignPersons, // Removed
    openAddNewModal, openEditModal, saveProject,
    deleteProject, approveProject, rejectProject, // allocateProject, assignProject, // Removed
    approveEditProject, rejectEditProject, approveDeleteProject, rejectDeleteProject,
    markProjectAsCompleted, // Export action mới
    moveProjectToNextYear, // Export action mới
    restoreRejectedProject, permanentlyDeleteRejectedProject,
    showExcelImportModal, setShowExcelImportModal, excelImportData, setExcelImportData,
    excelImportHeaders, setExcelImportHeaders, handleDownloadTemplate, handleFileImport,
    submitExcelData, isImportingExcel: importProjectsMutation.isLoading,
    excelImportBackendErrors, // Expose backend errors
    isSubmitting: saveProjectMutation.isLoading,
    isSubmittingAction: deleteProjectMutation.isLoading || approveProjectMutation.isLoading ||
                        rejectProjectMutation.isLoading || /* allocateProjectMutation.isLoading || */ // Removed
                        /* assignProjectMutation.isLoading || */ restoreRejectedProjectMutation.isLoading || // Removed
                        permanentlyDeleteRejectedProjectMutation.isLoading || markAsCompletedMutation.isLoading ||
                        moveToNextYearMutation.isLoading,
  };
};

// Main logic hook that combines data fetching and actions
function ProjectManagementLogic({ user, type, showHeader, addMessage }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('projects'); // Manage activeTab here
  const [showFilter, setShowFilter] = useState(true); // Manage showFilter here

  const {
    projectsData, pendingProjectsData, rejectedProjectsData,
    isLoading, isFetching,
    currentPage, setCurrentPage, currentPageRejected, setCurrentPageRejected,
    sortOrder, setSortOrder, filters, setFilters, initialFilters,
    allocatedUnits, allocationWavesList, constructionUnitsList, usersList, approversList, projectTypesList,
    handleSortChange, handleResetFilters: resetDataFilters, // Renamed to avoid conflict
    refetchProjects, refetchPendingProjects, refetchRejectedProjects,
  } = useProjectData(user, type, activeTab, itemsPerPageGlobal);

  const {
    showModal, setShowModal, formData, setFormData, editProject, setEditProject,
    // allocateWaves, setAllocateWaves, assignPersons, setAssignPersons, // Removed
    openAddNewModal, openEditModal, saveProject,
    deleteProject, approveProject, rejectProject, // allocateProject, assignProject, // Removed
    approveEditProject, rejectEditProject, approveDeleteProject, rejectDeleteProject,
    markProjectAsCompleted, moveProjectToNextYear, // Thêm các action mới
    restoreRejectedProject, permanentlyDeleteRejectedProject,
    showExcelImportModal, setShowExcelImportModal, excelImportData, setExcelImportData,
    excelImportHeaders, setExcelImportHeaders, handleDownloadTemplate, handleFileImport,
    submitExcelData, isImportingExcel, excelImportBackendErrors,
    isSubmitting, isSubmittingAction,
  } = useProjectActions(user, type, queryClient, addMessage);

  const handleResetFilters = useCallback(() => {
    resetDataFilters(); // Call the reset from useProjectData
    // Any other reset logic specific to ProjectManagementLogic can go here
  }, [resetDataFilters]);

  return {
    // From useProjectData
    projectsData, pendingProjectsData, rejectedProjectsData,
    isLoading, isFetching,
    currentPage, setCurrentPage, currentPageRejected, setCurrentPageRejected,
    sortOrder, setSortOrder, filters, setFilters, initialFilters,
    allocatedUnits, allocationWavesList, constructionUnitsList, usersList, approversList, projectTypesList,
    handleSortChange, handleResetFilters,
    refetchProjects, refetchPendingProjects, refetchRejectedProjects,
    // From useProjectActions
    showModal, setShowModal, formData, setFormData, editProject, setEditProject,
    // allocateWaves, setAllocateWaves, assignPersons, setAssignPersons, // Removed
    openAddNewModal, openEditModal, saveProject,
    deleteProject, approveProject, rejectProject, // allocateProject, assignProject, // Removed
    approveEditProject, rejectEditProject, approveDeleteProject, rejectDeleteProject,
    markProjectAsCompleted, moveProjectToNextYear, // Thêm các action mới
    restoreRejectedProject, permanentlyDeleteRejectedProject,
    showExcelImportModal, setShowExcelImportModal, excelImportData, setExcelImportData,
    excelImportHeaders, setExcelImportHeaders, handleDownloadTemplate, handleFileImport,
    submitExcelData, isImportingExcel, excelImportBackendErrors,
    isSubmitting, isSubmittingAction,
    // Local state for ProjectManagement
    activeTab, setActiveTab,
    showFilter, setShowFilter,
    // Derived data for UI
    filteredProjects: projectsData?.projects || [],
    totalProjectsCount: projectsData?.total || 0,
    totalPages: projectsData?.pages || 1,
    pendingProjects: pendingProjectsData?.projects || [],
    totalPendingCount: pendingProjectsData?.total || 0,
    totalPagesPending: pendingProjectsData?.pages || 1,
    rejectedProjects: rejectedProjectsData?.rejectedProjects || [],
    totalRejectedCount: rejectedProjectsData?.total || 0,
    totalPagesRejected: rejectedProjectsData?.pages || 1,
  };
}

export default ProjectManagementLogic;
