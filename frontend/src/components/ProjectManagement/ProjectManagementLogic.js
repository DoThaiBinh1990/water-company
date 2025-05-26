// d:\CODE\water-company\frontend\src\components\ProjectManagement\ProjectManagementLogic.js
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import io from 'socket.io-client';
import { toast } from 'react-toastify';
import {
  getProjects, createProject, updateProject, deleteProject as deleteProjectAPI,
  approveProject as approveProjectAPI, rejectProject as rejectProjectAPI,
  getRejectedProjects, restoreRejectedProject as restoreRejectedProjectAPI,
  permanentlyDeleteRejectedProject as permanentlyDeleteRejectedProjectAPI,
  getAllocatedUnits, getAllocationWaves, getConstructionUnits, getUsers, getProjectTypes,
  apiClient, importProjects as importProjectsAPI,
  markProjectAsCompletedAPI, moveProjectToNextFinancialYearAPI,
} from '../../apiService';
import { areDatesEqualClientSide } from '../../utils/dateUtils'; // Import hàm so sánh ngày
import { generateExcelTemplate, readExcelData } from '../../utils/excelHelper';

const socket = io(apiClient.defaults.baseURL, {
  transports: ['websocket', 'polling'],
  withCredentials: true,
  autoConnect: false,
});

const itemsPerPageGlobal = 10;

const useProjectData = (user, type, activeTab, itemsPerPage = itemsPerPageGlobal) => {
  const queryClient = useQueryClient();
  const isCategory = type === 'category';
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState('serial_asc');
  const [currentPageRejected, setCurrentPageRejected] = useState(1);

  const initialFilters = useMemo(() => ({
    financialYear: new Date().getFullYear(),
    isCompleted: false, // Default to 'false' (Chưa hoàn thành)
    status: '', allocatedUnit: '', constructionUnit: '', name: '',
    minInitialValue: '', maxInitialValue: '', progress: '',
    allocationWave: '', supervisor: '', estimator: '', reportDate: '', assignedTo: '',
    projectType: '', // For category projects
    requestedBy: '',
    rejectedBy: '',
  }), []);
  const [filters, setFilters] = useState(initialFilters);

  const buildProjectQueryParams = useCallback((page, currentSortOrder, currentFilters, isPending) => {
    const params = { type, page, limit: itemsPerPage };
    const activeApiFilters = {};

    if (currentFilters.financialYear) activeApiFilters.financialYear = currentFilters.financialYear;
    // Always send isCompleted, default to false if not explicitly set to true
    activeApiFilters.isCompleted = currentFilters.isCompleted === true || String(currentFilters.isCompleted).toLowerCase() === 'true';

    if (currentFilters.status) activeApiFilters.status = currentFilters.status;
    if (currentFilters.allocatedUnit) activeApiFilters.allocatedUnit = currentFilters.allocatedUnit;
    if (isCategory && currentFilters.constructionUnit) activeApiFilters.constructionUnit = currentFilters.constructionUnit;
    if (isCategory && currentFilters.projectType) activeApiFilters.projectType = currentFilters.projectType;
    if (currentFilters.name) activeApiFilters.search = currentFilters.name;
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
    return params;
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
    if (currentFilters.name) params.search = currentFilters.name;
    if (currentFilters.financialYear) params.financialYear = currentFilters.financialYear;
    if (currentFilters.allocatedUnit) params.allocatedUnit = currentFilters.allocatedUnit;
    if (currentFilters.requestedBy) params.requestedBy = currentFilters.requestedBy;
    if (currentFilters.rejectedBy) params.rejectedBy = currentFilters.rejectedBy;
    return params;
  }, [type, itemsPerPage]);

  const { data: rejectedProjectsData, isLoading: isLoadingRejected, isFetching: isFetchingRejected, refetch: refetchRejectedProjects } = useQuery({
    queryKey: ['rejectedProjects', type, currentPageRejected, filters],
    queryFn: () => getRejectedProjects(buildRejectedProjectQueryParams(currentPageRejected, filters)),
    enabled: !!user && activeTab === 'rejected',
    keepPreviousData: true,
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi tải danh sách bị từ chối!', { position: "top-center" }),
  });

  const { data: allocatedUnitsData = [] } = useQuery({ queryKey: ['allocatedUnits'], queryFn: getAllocatedUnits, enabled: !!user });
  const { data: allocationWavesListData = [] } = useQuery({ queryKey: ['allocationWaves'], queryFn: getAllocationWaves, enabled: !!user });
  const { data: constructionUnitsListData = [] } = useQuery({ queryKey: ['constructionUnits'], queryFn: getConstructionUnits, enabled: !!user });
  const { data: usersData = [] } = useQuery({ queryKey: ['users'], queryFn: getUsers, enabled: !!user });
  const { data: projectTypesListData = [] } = useQuery({ queryKey: ['projectTypes'], queryFn: getProjectTypes, enabled: !!user });

  const allocatedUnits = useMemo(() => allocatedUnitsData.map(unit => typeof unit === 'object' && unit.name ? unit.name : String(unit)), [allocatedUnitsData]);
  const allocationWavesList = useMemo(() => allocationWavesListData.map(wave => wave.name || String(wave)), [allocationWavesListData]);
  const constructionUnitsList = useMemo(() => constructionUnitsListData.map(unit => typeof unit === 'object' && unit.name ? unit.name : String(unit)), [constructionUnitsListData]);
  const usersList = useMemo(() => usersData.map(u => ({ _id: u._id, fullName: u.fullName || u.username })), [usersData]);
  const approversList = useMemo(() => usersData.filter(u => u.permissions?.approve), [usersData]);
  const projectTypesList = useMemo(() => projectTypesListData.map(pt => pt.name || String(pt)), [projectTypesListData]);

  const isLoading = isLoadingProjects || isLoadingPending || isLoadingRejected;
  const isFetching = isFetchingProjects || isFetchingPending || isFetchingRejected;

  const handleSortChange = useCallback((e) => {
    setSortOrder(e.target.value);
    setCurrentPage(1);
    if (activeTab === 'rejected') setCurrentPageRejected(1);
  }, [activeTab]);

  const handleResetFilters = useCallback(() => {
    setFilters(initialFilters);
    setCurrentPage(1);
    if (activeTab === 'rejected') setCurrentPageRejected(1);
  }, [initialFilters, activeTab]);

  useEffect(() => {
    const invalidateProjectQueries = () => {
      queryClient.invalidateQueries({ queryKey: ['projects', type] });
      queryClient.invalidateQueries({ queryKey: ['pendingProjects', type] });
    };
    const invalidateAllProjectRelatedQueries = () => {
      invalidateProjectQueries();
      queryClient.invalidateQueries({ queryKey: ['rejectedProjects', type] });
    };

    if (user) {
      if (!socket.connected) socket.connect();
      socket.on('project_deleted', ({ projectType: eventProjectType }) => { if (eventProjectType === type) invalidateAllProjectRelatedQueries(); });
      socket.on('project_rejected_and_removed', ({ projectType: eventProjectType }) => { if (eventProjectType === type) invalidateAllProjectRelatedQueries(); });
      socket.on('notification_processed', () => invalidateProjectQueries());
      socket.on('project_updated', ({ projectType: eventProjectType }) => { if (eventProjectType === type) invalidateProjectQueries(); });
      socket.on('project_approved', ({ projectType: eventProjectType }) => { if (eventProjectType === type) invalidateProjectQueries(); });
      socket.on('project_rejected_restored', ({ projectType: eventProjectType }) => { if (eventProjectType === type) invalidateAllProjectRelatedQueries(); });
      socket.on('project_rejected_permanently_deleted', ({ projectType: eventProjectType }) => { if (eventProjectType === type) queryClient.invalidateQueries({ queryKey: ['rejectedProjects', type] }); });

      return () => {
        socket.off('project_deleted');
        socket.off('project_rejected_and_removed');
        socket.off('notification_processed');
        socket.off('project_updated');
        socket.off('project_approved');
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

const useProjectActions = (user, type, queryClient, addMessage) => {
  const isCategory = type === 'category';
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(null);
  const [editProject, setEditProject] = useState(null);
  const [showExcelImportModal, setShowExcelImportModal] = useState(false);
  const [excelImportData, setExcelImportData] = useState(null);
  const [excelImportHeaders, setExcelImportHeaders] = useState([]);
  const [excelImportBackendErrors, setExcelImportBackendErrors] = useState(null);

  const initialFormData = useCallback(() => {
    const baseState = {
      name: '', allocatedUnit: '', supervisor: '', taskDescription: '', notes: '',
      approvedBy: '', createdBy: user?._id || '',
      financialYear: new Date().getFullYear(),
      isCompleted: false, // Default isCompleted to false
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
  }, [initialFormData]);

  const openEditModal = useCallback((project) => {
    setEditProject(project);
    const formatForInput = (dateStr) => dateStr ? new Date(dateStr).toISOString().split('T')[0] : '';
    const getUserId = (userData) => {
      if (userData && typeof userData === 'object' && userData._id) return userData._id;
      if (typeof userData === 'string' && userData.match(/^[0-9a-fA-F]{24}$/)) return userData;
      if (typeof userData === 'string') return userData;
      return '';
    };

    const baseData = {
      name: project.name || '', allocatedUnit: project.allocatedUnit || '',
      supervisor: getUserId(project.supervisor), taskDescription: project.taskDescription || '',
      notes: project.notes || '', 
      // Khi sửa, approvedBy trên form nên là người duyệt hiện tại của công trình (nếu có)
      // hoặc người duyệt trong pendingEdit (nếu đang sửa một YC sửa)
      approvedBy: getUserId(project.pendingEdit?.data?.approvedBy || project.approvedBy),
      createdBy: getUserId(project.createdBy), // Giữ createdBy gốc khi sửa, không cho thay đổi trên form
      financialYear: project.financialYear || new Date().getFullYear(),
      isCompleted: project.isCompleted === true, // Ensure boolean
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
        inspectionDate: formatForInput(project.inspectionDate),
        paymentDate: formatForInput(project.paymentDate),
        paymentValue: project.paymentValue ?? '', location: project.location || '', scale: project.scale || '',
        leadershipApproval: project.leadershipApproval || '',
      };
    }
    setFormData(projectDataToSet);
    setShowModal(true);
  }, [isCategory, user]);

  const saveProjectMutation = useMutation({
    mutationFn: async (projectPayload) => {
      const payload = { ...projectPayload, type };
      const numericFieldsCategory = ['initialValue', 'durationDays', 'contractValue', 'estimatedValue'];
      const numericFieldsMinor = ['paymentValue'];
      const fieldsToParse = isCategory ? numericFieldsCategory : numericFieldsMinor;

      if (payload.financialYear) payload.financialYear = parseInt(payload.financialYear, 10);
      // isCompleted is already boolean from form

      fieldsToParse.forEach((field) => {
        const value = payload[field];
        payload[field] = (value === '' || value === null || value === undefined || isNaN(parseFloat(String(value).replace(/,/g, '')))) ? null : parseFloat(String(value).replace(/,/g, ''));
      });
      if (payload.durationDays !== null && payload.durationDays !== undefined) {
        payload.durationDays = parseInt(String(payload.durationDays), 10) || null;
      }

      const fieldsToRemove = isCategory
        ? ['reportDate', 'inspectionDate', 'paymentDate', 'paymentValue']
        : ['constructionUnit', 'allocationWave', 'estimator', 'durationDays', 'startDate', 'completionDate', 'contractValue', 'progress', 'feasibility', 'projectType', 'estimatedValue'];
      fieldsToRemove.forEach(field => delete payload[field]);

      if (payload.supervisor === '') payload.supervisor = null;
      if (isCategory && payload.estimator === '') payload.estimator = null;

      return editProject ? updateProject({ projectId: editProject._id, type, data: payload }) : createProject(payload);
    },
    onMutate: async (projectPayload) => {
      // Logic này chỉ chạy khi đang SỬA công trình (editProject tồn tại)
      if (editProject) {
        const timelineToCompare = isCategory ? editProject.profileTimeline : editProject.constructionTimeline;

        if (timelineToCompare && timelineToCompare.assignmentType === 'auto') {
          let datesChanged = false;
          const formStartDate = projectPayload.startDate; // Đây là string 'YYYY-MM-DD' từ formData
          const timelineStartDate = timelineToCompare.startDate; // Đây là Date object hoặc ISO string từ DB

          const formCompletionDate = projectPayload.completionDate; // String 'YYYY-MM-DD'
          const timelineCompletionDate = timelineToCompare.endDate; // Date object hoặc ISO string

          const formDurationDays = projectPayload.durationDays ? parseInt(String(projectPayload.durationDays), 10) : null;
          const timelineDurationDays = timelineToCompare.durationDays ? parseInt(String(timelineToCompare.durationDays), 10) : null;

          if (!areDatesEqualClientSide(formStartDate, timelineStartDate)) {
            datesChanged = true;
          }
          if (isCategory && !areDatesEqualClientSide(formCompletionDate, timelineCompletionDate)) {
            datesChanged = true;
          }
          if (formDurationDays !== timelineDurationDays) {
            datesChanged = true;
          }

          if (datesChanged) {
            // Gán cờ vào projectPayload để nó được gửi đi trong mutationFn
            // Lưu ý: projectPayload ở đây là bản sao, không phải formData gốc
            projectPayload.forceManualTimeline = true;
          }
        }
      }
      // Không cần return gì từ onMutate nếu không dùng cho optimistic updates
    },
    onSuccess: (data) => {
      let successMessage = data.message || (editProject ? 'Đã cập nhật công trình!' : 'Đã đăng ký công trình!');
      if (data?.project?.pendingEdit || (!editProject && data?.project?.status === 'Chờ duyệt')) {
        // successMessage += ' Công trình đang ở trạng thái "Chờ duyệt".'; // Bỏ bớt thông báo này
      }
      addMessage(successMessage, 'success');
      setFormData(initialFormData());
      queryClient.invalidateQueries({ queryKey: ['projects', type] });
      queryClient.invalidateQueries({ queryKey: ['pendingProjects', type] });
      setShowModal(false);
    },
    onError: (err) => addMessage(err.response?.data?.message || 'Lỗi khi lưu công trình!', 'error'),
  });

  const saveProject = useCallback(() => {
    // Basic validation, more specific validation can be added
    if (!formData.name || !formData.allocatedUnit || !formData.location || !formData.scale || !formData.approvedBy || !formData.financialYear) {
      addMessage('Vui lòng nhập đầy đủ các trường cơ bản bắt buộc!', 'error'); return;
    }
    if (isCategory && !formData.projectType) {
      addMessage('Vui lòng chọn Loại công trình cho công trình danh mục!', 'error'); return;
    }
    if (!isCategory && !formData.reportDate) {
      addMessage('Vui lòng nhập Ngày xảy ra sự cố cho công trình sửa chữa nhỏ!', 'error'); return;
    }
    saveProjectMutation.mutate(formData);
  }, [saveProjectMutation, formData, isCategory, addMessage]);

  const useGenericActionMutation = (mutationFn, { successMsg, invalidateRejected = false } = {}) => {
    return useMutation({
      mutationFn,
      onSuccess: (data) => {
        addMessage(data.message || successMsg || "Thao tác thành công!", 'success');
        queryClient.invalidateQueries({ queryKey: ['projects', type] });
        queryClient.invalidateQueries({ queryKey: ['pendingProjects', type] });
        if (invalidateRejected) queryClient.invalidateQueries({ queryKey: ['rejectedProjects', type] });
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
      restoreRejectedProjectMutation.mutate({ rejectedId });
    }
  };

  const permanentlyDeleteRejectedProjectMutation = useGenericActionMutation(permanentlyDeleteRejectedProjectAPI, { successMsg: 'Công trình bị từ chối đã được xóa vĩnh viễn.', invalidateRejected: true });
  const permanentlyDeleteRejectedProject = (rejectedId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn công trình bị từ chối này? Hành động này không thể hoàn tác.')) return;
    permanentlyDeleteRejectedProjectMutation.mutate(rejectedId);
  };

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
      setExcelImportBackendErrors(null);
    } catch (error) {
      addMessage(error.message || "Lỗi khi đọc file Excel.", 'error');
      console.error("Error processing Excel file:", error);
    }
  }, [addMessage]);

  const importProjectsMutation = useMutation({
    mutationFn: (projectsToImport) => importProjectsAPI({ projects: projectsToImport, projectType: type }),
    onSuccess: (data) => {
      addMessage(data.message || "Tất cả công trình đã được nhập thành công!", 'success');
      queryClient.invalidateQueries({ queryKey: ['projects', type] });
      queryClient.invalidateQueries({ queryKey: ['pendingProjects', type] });
      setShowExcelImportModal(false);
      setExcelImportData(null);
      setExcelImportHeaders([]);
      setExcelImportBackendErrors(null);
    },
    onError: (error) => {
      const errorData = error.response?.data;
      if (errorData && errorData.results && Array.isArray(errorData.results)) {
        addMessage(errorData.message || "Có lỗi trong dữ liệu Excel. Vui lòng kiểm tra lại bảng.", 'error');
        setExcelImportBackendErrors(errorData.results);
      } else {
        addMessage(error.response?.data?.message || "Lỗi không xác định khi nhập công trình từ Excel!", 'error');
      }
    }
  });
  const submitExcelData = useCallback((processedData) => importProjectsMutation.mutate(processedData), [importProjectsMutation]);

  return {
    showModal, setShowModal, formData, setFormData, editProject, setEditProject,
    openAddNewModal, openEditModal, saveProject, initialFormData,
    deleteProject, approveProject, rejectProject,
    approveEditProject, rejectEditProject, approveDeleteProject, rejectDeleteProject,
    markProjectAsCompleted, moveProjectToNextYear,
    restoreRejectedProject, permanentlyDeleteRejectedProject,
    showExcelImportModal, setShowExcelImportModal, excelImportData, setExcelImportData,
    excelImportHeaders, setExcelImportHeaders, handleDownloadTemplate, handleFileImport,
    submitExcelData, isImportingExcel: importProjectsMutation.isLoading,
    excelImportBackendErrors,
    isSubmitting: saveProjectMutation.isLoading,
    isSubmittingAction: deleteProjectMutation.isLoading || approveProjectMutation.isLoading ||
                        rejectProjectMutation.isLoading || restoreRejectedProjectMutation.isLoading ||
                        permanentlyDeleteRejectedProjectMutation.isLoading || markAsCompletedMutation.isLoading ||
                        moveToNextYearMutation.isLoading,
  };
};

function ProjectManagementLogic({ user, type, showHeader, addMessage }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('projects');
  const [showFilter, setShowFilter] = useState(true);

  const projectDataProps = useProjectData(user, type, activeTab, itemsPerPageGlobal);
  const projectActionsProps = useProjectActions(user, type, queryClient, addMessage);

  const handleResetFilters = useCallback(() => {
    projectDataProps.handleResetFilters();
  }, [projectDataProps]);

  return {
    ...projectDataProps,
    ...projectActionsProps,
    activeTab, setActiveTab,
    showFilter, setShowFilter,
    handleResetFilters, // Ensure this is the one from projectDataProps or wrapped one
    // Derived data for UI
    filteredProjects: projectDataProps.projectsData?.projects || [],
    totalProjectsCount: projectDataProps.projectsData?.total || 0,
    totalPages: projectDataProps.projectsData?.pages || 1,
    pendingProjects: projectDataProps.pendingProjectsData?.projects || [],
    totalPendingCount: projectDataProps.pendingProjectsData?.total || 0,
    totalPagesPending: projectDataProps.pendingProjectsData?.pages || 1,
    rejectedProjects: projectDataProps.rejectedProjectsData?.rejectedProjects || [],
    totalRejectedCount: projectDataProps.rejectedProjectsData?.total || 0,
    totalPagesRejected: projectDataProps.rejectedProjectsData?.pages || 1,
  };
}

export default ProjectManagementLogic;
