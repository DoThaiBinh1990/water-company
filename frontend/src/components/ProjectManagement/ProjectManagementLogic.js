// d:\CODE\water-company\frontend\src\components\ProjectManagement\ProjectManagementLogic.js
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import io from 'socket.io-client';
import debounce from 'lodash/debounce';
import { toast } from 'react-toastify';
import { API_URL } from '../../config'; // API_URL có thể không cần nữa nếu dùng apiClient.defaults.baseURL
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject as deleteProjectAPI, // Đổi tên hàm import
  approveProject as approveProjectAPI,
  rejectProject as rejectProjectAPI,
  allocateProject as allocateProjectAPI,
  assignProject as assignProjectAPI,
  getRejectedProjects,
  restoreRejectedProject as restoreRejectedProjectAPI,
  permanentlyDeleteRejectedProject as permanentlyDeleteRejectedProjectAPI,
  getAllocatedUnits, getAllocationWaves, getConstructionUnits, getUsers, getProjectTypes,
  apiClient, // Import apiClient từ apiService
  importProjects as importProjectsAPI, // API mới
} from '../../apiService'; // Import các hàm API
import { generateExcelTemplate, readExcelData } from '../../utils/excelHelper';

const socket = io(apiClient.defaults.baseURL, { // Sử dụng baseURL từ apiClient
  transports: ['websocket', 'polling'],
  withCredentials: true,
  autoConnect: false,
});

function ProjectManagementLogic({ user, type, showHeader, addMessage }) {
  const isCategory = type === 'category';
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState('serial_asc');
  const [showFilter, setShowFilter] = useState(true);

  // Gom nhóm state filter
  const [filters, setFilters] = useState({
    status: '',
    allocatedUnit: '',
    constructionUnit: '',
    name: '',
    minInitialValue: '',
    maxInitialValue: '',
    progress: '',
    allocationWave: '',
    supervisor: '',
    estimator: '',
    reportDate: '',
  });

  const [formData, setFormData] = useState(null); // Đổi tên newProject thành formData
  const [editProject, setEditProject] = useState(null);

  const [allocateWaves, setAllocateWaves] = useState({});
  const [assignPersons, setAssignPersons] = useState({});

  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('projects');

  // States for Excel Import
  const [showExcelImportModal, setShowExcelImportModal] = useState(false);
  const [excelImportData, setExcelImportData] = useState(null);
  const [excelImportHeaders, setExcelImportHeaders] = useState([]);

  const initialFilters = useMemo(() => ({
    status: '',
    allocatedUnit: '',
    constructionUnit: '',
    name: '',
    minInitialValue: '',
    maxInitialValue: '',
    progress: '',
    allocationWave: '',
    supervisor: '',
    estimator: '',
    reportDate: '',
  }), []);

  const initialFormData = useCallback(() => {
    const baseState = {
      name: '',
      allocatedUnit: '',
      supervisor: '',
      taskDescription: '',
      notes: '',
      approvedBy: '',
      createdBy: user?._id || '',
    };
    if (isCategory) {
      return {
        ...baseState,
        constructionUnit: '',
        allocationWave: '',
        location: '',
        scale: '',
        initialValue: '',
        estimator: '',
        durationDays: '',
        startDate: '',
        completionDate: '',
        contractValue: '',
        progress: '',
        feasibility: '',
        projectType: '',
        estimatedValue: '',
        leadershipApproval: '',
      };
    } else {
      return {
        ...baseState,
        serial: '',
        reportDate: '',
        inspectionDate: '',
        paymentDate: '',
        paymentValue: '',
        location: '',
        scale: '',
        leadershipApproval: '',
      };
    }
  }, [isCategory, user]);

  useEffect(() => {
    // Khởi tạo formData khi component mount hoặc khi initialFormData thay đổi
    setFormData(initialFormData());
  }, [initialFormData]);

  // --- QUERIES ---
  const buildProjectQueryParams = (page, currentSortOrder, currentFilters, isPending) => {
    const params = { type, page, limit: 10 };
    const activeApiFilters = {};
    if (currentFilters.status) activeApiFilters.status = currentFilters.status;
    if (currentFilters.allocatedUnit) activeApiFilters.allocatedUnit = currentFilters.allocatedUnit;
    if (isCategory && currentFilters.constructionUnit) activeApiFilters.constructionUnit = currentFilters.constructionUnit;
    if (currentFilters.name) activeApiFilters.search = currentFilters.name;
    if (isCategory && currentFilters.minInitialValue) activeApiFilters.minInitialValue = currentFilters.minInitialValue;
    if (isCategory && currentFilters.maxInitialValue) activeApiFilters.maxInitialValue = currentFilters.maxInitialValue;
    if (isCategory && currentFilters.progress) activeApiFilters.progress = currentFilters.progress;
    if (isCategory && currentFilters.allocationWave) activeApiFilters.allocationWave = currentFilters.allocationWave;
    if (currentFilters.supervisor) activeApiFilters.supervisor = currentFilters.supervisor;
    if (isCategory && currentFilters.estimator) activeApiFilters.estimator = currentFilters.estimator;
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
  };

  const { data: projectsData, isLoading: isLoadingProjects, isFetching: isFetchingProjects } = useQuery({
    queryKey: ['projects', type, currentPage, sortOrder, filters],
    queryFn: () => getProjects(buildProjectQueryParams(currentPage, sortOrder, filters, false)),
    enabled: !!user && activeTab === 'projects',
    keepPreviousData: true,
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi tải danh sách công trình!', { position: "top-center" }),
  });

  const { data: pendingProjectsData, isLoading: isLoadingPending, isFetching: isFetchingPending } = useQuery({
    queryKey: ['pendingProjects', type, currentPage, sortOrder, filters], // Thêm currentPage và filters
    queryFn: () => getProjects(buildProjectQueryParams(currentPage, sortOrder, filters, true)), // Sử dụng currentPage và filters
    enabled: !!user && activeTab === 'pending',
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi tải danh sách chờ duyệt!', { position: "top-center" }),
  });

  const { data: rejectedProjectsData, isLoading: isLoadingRejected, isFetching: isFetchingRejected } = useQuery({
    queryKey: ['rejectedProjects', type],
    queryFn: () => getRejectedProjects({ type }), // Giả sử API này không cần phân trang phức tạp trên UI này
    enabled: !!user && activeTab === 'rejected',
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi tải danh sách bị từ chối!', { position: "top-center" }),
  });

  const filteredProjects = projectsData?.projects || [];
  const totalProjectsCount = projectsData?.total || 0;
  const totalPages = projectsData?.pages || 1;
  const pendingProjects = pendingProjectsData?.projects || [];
  const rejectedProjects = rejectedProjectsData?.rejectedProjects || [];

  // Queries for auxiliary data
  const { data: allocatedUnits = [] } = useQuery({
    queryKey: ['allocatedUnits'], queryFn: getAllocatedUnits, enabled: !!user,
    select: data => data.map(unit => typeof unit === 'object' && unit.name ? unit.name : String(unit)),
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi tải đơn vị!', { position: "top-center" }),
  });
  const { data: allocationWavesList = [] } = useQuery({
    queryKey: ['allocationWaves'], queryFn: getAllocationWaves, enabled: !!user,
    select: data => data.map(wave => wave.name || String(wave)),
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi tải đợt phân bổ!', { position: "top-center" }),
  });
  const { data: constructionUnitsList = [] } = useQuery({
    queryKey: ['constructionUnits'], queryFn: getConstructionUnits, enabled: !!user,
    select: data => data.map(unit => typeof unit === 'object' && unit.name ? unit.name : String(unit)),
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi tải đơn vị thi công!', { position: "top-center" }),
  });
  const { data: usersData = [] } = useQuery({
    // Query này cần cho tất cả user có thể truy cập trang này để chọn người
    // enabled: !!user, // Bỏ điều kiện chỉ admin, cho phép tất cả user đã đăng nhập fetch
    queryKey: ['users'], queryFn: getUsers, enabled: !!user, // Fetch khi user tồn tại
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi tải danh sách người dùng!', { position: "top-center" }),
  });
  const { data: projectTypesList = [] } = useQuery({
    queryKey: ['projectTypes'], queryFn: getProjectTypes, enabled: !!user,
    select: data => data.map(pt => pt.name || String(pt)),
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi tải loại công trình!', { position: "top-center" }),
  });

  const usersList = useMemo(() => usersData.map(u => ({ _id: u._id, fullName: u.fullName || u.username || String(u) })), [usersData]);
  const approversList = useMemo(() => usersData.filter(u => u.permissions?.approve), [usersData]);

  const isLoading = isLoadingProjects || isLoadingPending || isLoadingRejected || isFetchingProjects || isFetchingPending || isFetchingRejected;

  useEffect(() => {
    if (!user) return;
    // Socket listeners
    const invalidateProjectQueries = () => {
      queryClient.invalidateQueries(['projects', type]);
      queryClient.invalidateQueries(['pendingProjects', type]);
    };

    const invalidateAllProjectRelatedQueries = () => {
      invalidateProjectQueries();
      queryClient.invalidateQueries(['rejectedProjects', type]);
    };

    if (user) {
      if (!socket.connected) {
        socket.connect();
      }
      socket.on('project_deleted', ({ projectId, projectType: eventProjectType }) => { // Đổi tên ở đây để rõ ràng
        if (eventProjectType === type) invalidateAllProjectRelatedQueries();
      });
      socket.on('project_rejected', ({ projectId, projectType: eventProjectType }) => {
        if (eventProjectType === type) invalidateAllProjectRelatedQueries();
      });
      socket.on('project_rejected_and_removed', ({ projectId, projectType: eventProjectType }) => {
        if (eventProjectType === type) invalidateAllProjectRelatedQueries();
      });
      socket.on('notification_processed', () => {
        invalidateProjectQueries();
      });
      socket.on('project_updated', ({ projectType: eventProjectType }) => {
        if (eventProjectType === type) invalidateProjectQueries();
      });
      socket.on('project_approved', ({ projectType: eventProjectType }) => {
        if (eventProjectType === type) invalidateProjectQueries();
      });
      socket.on('project_allocated', ({ projectType: eventProjectType }) => {
        if (eventProjectType === type) invalidateProjectQueries();
      });
      socket.on('project_assigned', ({ projectType: eventProjectType }) => {
        if (eventProjectType === type) invalidateProjectQueries();
      });

      return () => {
        socket.off('project_deleted');
        socket.off('project_rejected');
        socket.off('project_rejected_and_removed');
        socket.off('notification_processed');
        socket.off('project_updated');
        socket.off('project_approved');
        socket.off('project_allocated');
        socket.off('project_assigned');
      };
    }
  }, [user, type, queryClient]);

  const handleSortChange = (e) => {
    const newSortOrder = e.target.value;
    setSortOrder(newSortOrder);
  };

  const handleResetFilters = useCallback(() => {
    setFilters(initialFilters); // Reset toàn bộ object filters
  }, [initialFilters]);

  const openAddNewModal = () => {
    setEditProject(null);
    setFormData(initialFormData()); // Sử dụng initialFormData
    setShowModal(true);
  };

  const openEditModal = (project) => {
    setEditProject(project);
    const formatForInput = (dateStr) => dateStr ? new Date(dateStr).toISOString().split('T')[0] : '';
    let projectDataToSet = {};

    // Helper function to safely get user ID
    const getUserId = (userData) => {
      if (userData && typeof userData === 'object' && userData._id) {
        return userData._id;
      }
      return userData || ''; // Return the string ID or empty string
    };

    const baseData = {
      name: project.name || '',
      allocatedUnit: project.allocatedUnit || '',
      supervisor: getUserId(project.supervisor), // Đảm bảo lấy _id nếu là object
      taskDescription: project.taskDescription || '',
      notes: project.notes || '',
      approvedBy: getUserId(project.approvedBy),
      createdBy: getUserId(project.createdBy) || user?._id || '', // createdBy thường không thay đổi khi edit
    };

    if (isCategory) {
      projectDataToSet = {
        ...baseData,
        constructionUnit: project.constructionUnit || '',
        allocationWave: project.allocationWave || '',
        location: project.location || '',
        scale: project.scale || '',
        initialValue: project.initialValue ?? '',
        estimator: getUserId(project.estimator), // Đảm bảo lấy _id nếu là object
        durationDays: project.durationDays ?? '',
        startDate: formatForInput(project.startDate),
        completionDate: formatForInput(project.completionDate),
        contractValue: project.contractValue ?? '',
        progress: project.progress || '',
        feasibility: project.feasibility || '',
        projectType: project.projectType || '',
        estimatedValue: project.estimatedValue ?? '',
        leadershipApproval: project.leadershipApproval || '',
      };
    } else {
      projectDataToSet = {
        ...baseData,
        serial: project.minorRepairSerialNumber || '',
        reportDate: formatForInput(project.reportDate),
        inspectionDate: formatForInput(project.inspectionDate),
        paymentDate: formatForInput(project.paymentDate),
        paymentValue: project.paymentValue ?? '',
        location: project.location || '',
        scale: project.scale || '',
        leadershipApproval: project.leadershipApproval || '',
      };
    }
    setFormData(projectDataToSet); // Sử dụng setFormData
    setShowModal(true);
  };
  // --- MUTATIONS ---
  const saveProjectMutation = useMutation({
    mutationFn: async (projectPayload) => {
    // Kiểm tra các trường bắt buộc cho cả tạo mới và cập nhật
    if (isCategory) {
      if (!formData.name || !formData.allocatedUnit || !formData.projectType || !formData.scale || !formData.location || !formData.approvedBy) {
        toast.error('Vui lòng nhập đầy đủ các trường bắt buộc: Tên danh mục, Đơn vị phân bổ, Loại công trình, Quy mô, Địa điểm XD, và Người phê duyệt!', { position: "top-center" });
        return;
      }
    } else {
      // Áp dụng kiểm tra cho cả tạo mới và cập nhật
      if (!formData.name || !formData.allocatedUnit || !formData.location || !formData.scale || !formData.reportDate || !formData.approvedBy) {
        toast.error('Vui lòng nhập đầy đủ các trường bắt buộc: Tên công trình, Đơn vị phân bổ, Địa điểm, Quy mô, Ngày xảy ra sự cố, và Người phê duyệt!', { position: "top-center" });
        return;
      }
    }
    projectPayload = { ...projectPayload, type }; // Add type for API

    const numericFieldsCategory = ['initialValue', 'durationDays', 'contractValue', 'estimatedValue'];
    const numericFieldsMinor = ['paymentValue'];
    const fieldsToParse = isCategory ? numericFieldsCategory : numericFieldsMinor;

    fieldsToParse.forEach((field) => {
      const value = projectPayload[field];
      if (value === '' || value === null || value === undefined || isNaN(parseFloat(value))) {
        projectPayload[field] = null;
      } else {
        projectPayload[field] = parseFloat(value);
      }
    });

    if (projectPayload.durationDays !== null && projectPayload.durationDays !== undefined) {
      projectPayload.durationDays = parseInt(projectPayload.durationDays, 10) || null;
    }

    const fieldsToRemove = isCategory
      ? ['serial', 'reportDate', 'inspectionDate', 'paymentDate', 'paymentValue', 'minorRepairSerialNumber']
      : ['constructionUnit', 'allocationWave', 'estimator', 'durationDays', 'startDate', 'completionDate', 'contractValue', 'progress', 'feasibility', 'projectType', 'estimatedValue', 'categorySerialNumber'];
    fieldsToRemove.forEach(field => delete projectPayload[field]);

    if (!isCategory && !editProject) {
      // Ensure supervisor and estimator are null if empty string
      if (projectPayload.supervisor === '') {
          projectPayload.supervisor = null;
      }
      if (isCategory && projectPayload.estimator === '') {
          projectPayload.estimator = null;
      }


      // delete projectPayload.serial; // Backend sẽ tự tạo serial nếu không có
    }

      if (editProject) {
        return updateProject({ projectId: editProject._id, type, data: projectPayload });
      } else {
        return createProject(projectPayload);
      }
    },
    onMutate: (projectPayload) => {
      // Ensure supervisor and estimator are null if empty string BEFORE sending
      if (projectPayload.supervisor === '') {
          projectPayload.supervisor = null;
      }
      if (isCategory && projectPayload.estimator === '') {
          projectPayload.estimator = null;
      }
    },
    onSuccess: (data) => {
      let successMessage = data.message || (editProject ? 'Đã cập nhật công trình!' : 'Đã đăng ký công trình!');
      if (data?.project?.pendingEdit || (!editProject && data?.project?.status === 'Chờ duyệt')) {
        successMessage += ' Công trình đang ở trạng thái "Chờ duyệt".';
      }
      toast.success(successMessage, { position: "top-center" });
      setFormData(initialFormData()); // Reset formData
      queryClient.invalidateQueries(['projects', type]);
      queryClient.invalidateQueries(['pendingProjects', type]);
      if (!editProject) setCurrentPage(1); // Go to first page on new creation
      setShowModal(false);
    },
    onError: (err) => {
      const errorMessage = err.response?.data?.message || 'Lỗi khi lưu công trình!';
      toast.error(errorMessage, { position: "top-center" });
    },
  });
  const saveProject = () => saveProjectMutation.mutate(formData);

  const useCreateActionMutation = (mutationFn, { successMsg, confirmMsg, invalidateRejected = false } = {}) => {
    return useMutation({
      mutationFn,
      onSuccess: (data) => {
        toast.success(data.message || successMsg || "Thao tác thành công!", { position: "top-center" });
        queryClient.invalidateQueries(['projects', type]);
        queryClient.invalidateQueries(['pendingProjects', type]);
        if (invalidateRejected) {
          queryClient.invalidateQueries(['rejectedProjects', type]);
        }
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Thao tác thất bại!', { position: "top-center" });
      },
    });
  };

  const restoreRejectedProjectMutation = useCreateActionMutation(
    restoreRejectedProjectAPI,
    { successMsg: 'Công trình đã được khôi phục và duyệt!', invalidateRejected: true }
  );
  const restoreRejectedProject = (rejectedId, projectDetails, projectModel, originalProjectId, actionType) => {
    if (!window.confirm('Bạn có chắc chắn muốn khôi phục công trình này? Công trình sẽ được duyệt và chuyển vào danh sách chính.')) {
      return;
    }
    restoreRejectedProjectMutation.mutate({ rejectedId, projectDetails, projectModel, originalProjectId, actionType });
  };

  const permanentlyDeleteRejectedProjectMutation = useCreateActionMutation(
    permanentlyDeleteRejectedProjectAPI,
    { successMsg: 'Công trình bị từ chối đã được xóa vĩnh viễn.', invalidateRejected: true }
  );
  const permanentlyDeleteRejectedProject = (rejectedId) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn công trình bị từ chối này? Hành động này không thể hoàn tác.')) {
      permanentlyDeleteRejectedProjectMutation.mutate(rejectedId);
    }
  };

  const handleActionWithConfirm = (mutation, variables, confirmMessage = "Bạn có chắc chắn?") => {
    if (window.confirm(confirmMessage)) {
      mutation.mutate(variables);
    }
  };

  const deleteProjectMutation = useCreateActionMutation(deleteProjectAPI); // Sử dụng hàm API đã đổi tên
  const deleteProject = (id) =>
    handleActionWithConfirm(deleteProjectMutation, { projectId: id, type },
      "Xác nhận Xóa hoặc gửi Yêu cầu xóa công trình này?"
    );

  const approveProjectMutation = useCreateActionMutation(approveProjectAPI);
  const approveProject = (id) =>
    handleActionWithConfirm(approveProjectMutation, { projectId: id, type },
      "Xác nhận DUYỆT công trình này?"
    );

  const rejectProjectMutation = useCreateActionMutation(rejectProjectAPI);
  const rejectProject = (id) => {
    const reason = prompt("Vui lòng nhập lý do từ chối:");
    if (reason === null) return; // User cancelled
    if (!reason || reason.trim() === "") {
      toast.error("Lý do từ chối không được để trống.");
      return;
    }
    handleActionWithConfirm(rejectProjectMutation, { projectId: id, type, reason },
      "Xác nhận TỪ CHỐI công trình này?"
    );
  }

  const allocateProjectMutation = useCreateActionMutation(allocateProjectAPI);
  const allocateProject = (id) => {
    const constructionUnit = prompt("Nhập đơn vị thi công:");
    if (constructionUnit === null) return;
    if (!constructionUnit || constructionUnit.trim() === "") {
      toast.error("Đơn vị thi công không được để trống.");
      return;
    }
    const allocationWave = prompt("Nhập đợt phân bổ:");
    if (allocationWave === null) return;
    if (!allocationWave || allocationWave.trim() === "") {
      toast.error("Đợt phân bổ không được để trống.");
      return;
    }
    handleActionWithConfirm(allocateProjectMutation, { projectId: id, type, constructionUnit: constructionUnit.trim(), allocationWave: allocationWave.trim() },
      `Phân bổ cho ĐVTC "${constructionUnit.trim()}" (Đợt: "${allocationWave.trim()}")?`
    );
  };

  const assignProjectMutation = useCreateActionMutation(assignProjectAPI);
  const assignProject = (id) => {
    const supervisor = prompt("Nhập ID người giám sát:");
    if (supervisor === null) return;
    if (!supervisor || supervisor.trim() === "") {
      toast.error("ID người giám sát không được để trống.");
      return;
    }
    let estimator = null;
    if (isCategory) {
      estimator = prompt("Nhập ID người dự toán (nếu có):");
      if (estimator === null) return; // User cancelled at estimator prompt
    }

    const payload = { supervisor: supervisor.trim() };
    if (isCategory && estimator && estimator.trim() !== "") {
      payload.estimator = estimator.trim();
    }
    handleActionWithConfirm(assignProjectMutation, { projectId: id, type, ...payload },
      `Giao việc cho Giám sát ID: "${supervisor.trim()}"` + (isCategory && estimator && estimator.trim() ? ` và Dự toán ID: "${estimator.trim()}"` : "") + "?"
    );
  };

  // Approve/Reject Edit/Delete actions use the same approveProjectAPI and rejectProjectAPI
  // The backend /approve and /reject routes handle pendingEdit and pendingDelete logic.
  const approveEditProject = (id) =>
    handleActionWithConfirm(approveProjectMutation, { projectId: id, type },
      "Xác nhận DUYỆT yêu cầu sửa công trình này?"
    );

  const rejectEditProject = (id) => {
    const reason = prompt("Vui lòng nhập lý do từ chối yêu cầu sửa:");
    if (reason === null) return;
    if (!reason || reason.trim() === "") { toast.error("Lý do từ chối không được để trống."); return; }
    handleActionWithConfirm(rejectProjectMutation, { projectId: id, type, reason },
      "Xác nhận TỪ CHỐI yêu cầu sửa công trình này?"
    );
  }

  const approveDeleteProject = (id) =>
    handleActionWithConfirm(approveProjectMutation, { projectId: id, type },
      "Xác nhận DUYỆT yêu cầu xóa công trình này?"
    );

  const rejectDeleteProject = (id) => {
    const reason = prompt("Vui lòng nhập lý do từ chối yêu cầu xóa:");
    if (reason === null) return;
    if (!reason || reason.trim() === "") { toast.error("Lý do từ chối không được để trống."); return; }
    handleActionWithConfirm(rejectProjectMutation, { projectId: id, type, reason },
      "Xác nhận TỪ CHỐI yêu cầu xóa công trình này?"
    );
  }

  // --- EXCEL IMPORT LOGIC ---
  const handleDownloadTemplate = () => {
    try {
      generateExcelTemplate(type);
      toast.success("Đã tải file mẫu Excel!", { position: "top-center" });
    } catch (error) {
      toast.error("Lỗi khi tạo file mẫu Excel.", { position: "top-center" });
      console.error("Error generating Excel template:", error);
    }
  };

  const handleFileImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls)$/)) {
      toast.error("Vui lòng chọn file Excel (.xlsx hoặc .xls).", { position: "top-center" });
      return;
    }

    try {
      const { jsonData, headerRow } = await readExcelData(file);
      if (!jsonData || jsonData.length === 0) {
        toast.warn("File Excel rỗng hoặc không có dữ liệu.", { position: "top-center" });
        return;
      }
      // Cần map headerRow từ file Excel sang cấu hình cột của bạn (fieldName, required, optionsSource)
      // Đây là một bước quan trọng để modal biết cách hiển thị và validate.
      // Tạm thời, chúng ta sẽ truyền headerRow và jsonData, modal sẽ cố gắng map.
      // Lý tưởng nhất là bạn có một hàm map headerRow với formConfig.
      setExcelImportHeaders(headerRow); // Lưu header gốc từ file
      setExcelImportData(jsonData);
      setShowExcelImportModal(true);
    } catch (error) {
      toast.error(error.message || "Lỗi khi đọc file Excel.", { position: "top-center" });
      console.error("Error processing Excel file:", error);
    }
  };

  const importProjectsMutation = useMutation({
    mutationFn: (projectsToImport) => importProjectsAPI({ projects: projectsToImport, projectType: type }),
    onSuccess: (data) => {
      // Nếu backend trả về success (nghĩa là tất cả công trình đều hợp lệ và đã được lưu)
      toast.success(data.message || "Tất cả công trình đã được nhập thành công!", { position: "top-center" });
      queryClient.invalidateQueries(['projects', type]);
      queryClient.invalidateQueries(['pendingProjects', type]);
      setShowExcelImportModal(false);
      setExcelImportData(null);
      setExcelImportHeaders([]); // Clear headers
    },
    onError: (error) => {
      // Nếu backend trả về lỗi (ví dụ: status 400 với danh sách lỗi chi tiết)
      const errorData = error.response?.data;
      if (errorData && errorData.results && Array.isArray(errorData.results)) {
        toast.error(errorData.message || "Có lỗi trong dữ liệu. Vui lòng kiểm tra lại bảng.", { position: "top-center" });
        // Không đóng modal, không clear data.
        // ExcelImportModal sẽ cần một cách để nhận và hiển thị các lỗi này.
        // Chúng ta có thể truyền một hàm callback vào ExcelImportModal để cập nhật lỗi từ backend,
        // hoặc ProjectManagementLogic có thể set một state mới chứa lỗi backend và truyền xuống.
        // Để đơn giản, hiện tại chỉ hiển thị toast chung.
        // Nâng cao: Cập nhật validationErrors trong ExcelImportModal dựa trên errorData.results
        // Ví dụ: setExcelImportBackendErrors(errorData.results); // Cần thêm state này và truyền xuống modal
      } else {
        toast.error(error.response?.data?.message || "Lỗi không xác định khi nhập công trình từ Excel!", { position: "top-center" });
      }
      // Không đóng modal, không clear data để người dùng sửa
    }
  });
  const submitExcelData = (processedData) => importProjectsMutation.mutate(processedData);
  const isSubmitting = saveProjectMutation.isLoading;
  const isSubmittingAction =
    deleteProjectMutation.isLoading ||
    approveProjectMutation.isLoading ||
    rejectProjectMutation.isLoading ||
    allocateProjectMutation.isLoading ||
    assignProjectMutation.isLoading ||
    restoreRejectedProjectMutation.isLoading ||
    permanentlyDeleteRejectedProjectMutation.isLoading;
  
  const isImportingExcel = importProjectsMutation.isLoading;

return {
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
    formData,
    setFormData,
    editProject,
    setEditProject,
    allocateWaves,
    setAllocateWaves,
    assignPersons,
    setAssignPersons, // Giữ lại setAssignPersons vì nó được dùng trong renderTableActions
    allocatedUnits,
    constructionUnitsList,
    allocationWavesList,
    usersList,
    approversList,
    projectTypesList,
    showModal,
    setShowModal,
    isLoading, // This is the combined loading state
    isSubmittingAction,
    isSubmitting,
    activeTab,
    setActiveTab,
    initialFormData,
    filters,
    setFilters,
    handleSortChange,
    handleResetFilters,
    openAddNewModal,
    openEditModal,
    saveProject,
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
    // Excel import related
    handleFileImport,
    handleDownloadTemplate,
    showExcelImportModal,
    setShowExcelImportModal,
    excelImportData, setExcelImportData, // Để modal có thể clear khi đóng
    excelImportHeaders,
    submitExcelData,
    isImportingExcel,
  };
}

export default ProjectManagementLogic;
