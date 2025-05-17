// d:\CODE\water-company\frontend\src\components\ProjectManagement\ProjectManagementLogic.js
import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import debounce from 'lodash/debounce';
import { toast } from 'react-toastify';
import { API_URL } from 'config';

const socket = io(API_URL, {
  transports: ['websocket', 'polling'],
  withCredentials: true,
  autoConnect: false,
});

function ProjectManagementLogic({ user, type, showHeader, addMessage }) {
  const isCategory = type === 'category';
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [pendingProjects, setPendingProjects] = useState([]);
  const [rejectedProjects, setRejectedProjects] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState('serial_asc');
  const [showFilter, setShowFilter] = useState(true);
  const [totalProjectsCount, setTotalProjectsCount] = useState(0);

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

  const [allocatedUnits, setAllocatedUnits] = useState([]);
  const [constructionUnitsList, setConstructionUnitsList] = useState([]);
  const [allocationWavesList, setAllocationWavesList] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [approversList, setApproversList] = useState([]); // Thêm state cho người duyệt
  const [projectTypesList, setProjectTypesList] = useState([]); // Thêm state cho loại công trình

  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false); // State cho các hành động trên bảng
  const [activeTab, setActiveTab] = useState('projects');

  const initialFilters = useMemo(() => ({ // Vẫn giữ initialFilters để reset
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

  // Đổi tên initialNewProjectState thành initialFormData
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
        // editProjectAndRefetchPending, // This line seems to be a misplaced function call or variable
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

  const fetchProjects = useCallback(
    async (pageToFetch = 1, currentSortOrder = sortOrder, filterParams = {}, isPending = false) => {
      if (!user) {
        setFilteredProjects([]);
        setPendingProjects([]);
        setTotalPages(1);
        setTotalProjectsCount(0);
        return;
      }
      setIsLoading(true);
      const params = new URLSearchParams({ type, page: pageToFetch, limit: 10 });

      // Sử dụng state `filters` đã được gom nhóm
      const currentActiveFilters = { ...filters, ...filterParams }; // Cho phép ghi đè filter nếu cần

      // Lọc ra các filter không rỗng để gửi lên API
      const activeApiFilters = {};
      if (currentActiveFilters.status) activeApiFilters.status = currentActiveFilters.status;
      if (currentActiveFilters.allocatedUnit) activeApiFilters.allocatedUnit = currentActiveFilters.allocatedUnit;
      if (isCategory && currentActiveFilters.constructionUnit) activeApiFilters.constructionUnit = currentActiveFilters.constructionUnit;
      if (currentActiveFilters.name) activeApiFilters.search = currentActiveFilters.name; // API dùng 'search' cho tên
      if (isCategory && currentActiveFilters.minInitialValue) activeApiFilters.minInitialValue = currentActiveFilters.minInitialValue;
      if (isCategory && currentActiveFilters.maxInitialValue) activeApiFilters.maxInitialValue = currentActiveFilters.maxInitialValue;
      if (isCategory && currentActiveFilters.progress) activeApiFilters.progress = currentActiveFilters.progress;
      if (isCategory && currentActiveFilters.allocationWave) activeApiFilters.allocationWave = currentActiveFilters.allocationWave;
      if (currentActiveFilters.supervisor) activeApiFilters.supervisor = currentActiveFilters.supervisor;
      if (isCategory && currentActiveFilters.estimator) activeApiFilters.estimator = currentActiveFilters.estimator;
      if (!isCategory && currentActiveFilters.reportDate) activeApiFilters.reportDate = currentActiveFilters.reportDate;


      console.log('Fetching projects with API filters:', activeApiFilters, 'Page:', pageToFetch);

      Object.entries(activeApiFilters).forEach(([key, value]) => {
        if (value) { // Đảm bảo chỉ gửi giá trị không rỗng
          params.append(key, value);
        }
      });

      if (currentSortOrder === 'serial_asc') {
        params.append('sort', isCategory ? 'categorySerialNumber' : 'minorRepairSerialNumber');
        params.append('order', 'asc');
      } else if (currentSortOrder === 'created_desc') {
        params.append('sort', 'createdAt');
        params.append('order', 'desc');
      }

      try {
        if (isPending) {
          params.append('pending', 'true');
        }

        console.log('API URL:', `${API_URL}/api/projects?${params.toString()}`);
        const projectsRes = await axios.get(`${API_URL}/api/projects?${params.toString()}`);
        console.log('API Response:', projectsRes.data);

        const rawProjects = projectsRes.data.projects || [];

        // Chuẩn hóa dữ liệu user ở client-side nếu backend chưa populate đầy đủ
        const normalizedProjects = rawProjects.map(project => {
          const newProject = { ...project };
          ['supervisor', 'estimator', 'createdBy', 'approvedBy'].forEach(userField => {
            if (newProject[userField] && typeof newProject[userField] === 'string') {
              // Nếu trường user là string (ID), tìm trong usersList
              const foundUser = usersList.find(u => u._id === newProject[userField]);
              if (foundUser) {
                newProject[userField] = foundUser; // Thay thế ID bằng object user từ usersList
              }
            }
          });
          if (newProject.pendingEdit && newProject.pendingEdit.requestedBy && typeof newProject.pendingEdit.requestedBy === 'string') {
            const foundUser = usersList.find(u => u._id === newProject.pendingEdit.requestedBy);
            if (foundUser) newProject.pendingEdit.requestedBy = foundUser;
          }
          return newProject;
        });

        if (isPending) { // Backend already filters based on 'pending=true'
          setPendingProjects(normalizedProjects);
        } else {
          setFilteredProjects(normalizedProjects);
          setTotalProjectsCount(projectsRes.data.total || 0);
          setTotalPages(projectsRes.data.pages || 1);
        }
      } catch (error) {
        console.error("Lỗi khi tải danh sách công trình:", error.response?.data?.message || error.message);
        toast.error(error.response?.data?.message || 'Lỗi khi tải danh sách công trình!', { position: "top-center" });
        if (isPending) {
          setPendingProjects([]);
        } else {
          setFilteredProjects([]);
          setTotalProjectsCount(0);
          setTotalPages(1);
          setCurrentPage(1);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [
      user,
      type,
      isCategory,
      sortOrder,
      filters, usersList // usersList đã có ở đây, đảm bảo nó được cập nhật và truyền đi
    ]
  );

  const fetchRejectedProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/rejected-projects`);
      setRejectedProjects(res.data.rejectedProjects || []); // Sửa ở đây để lấy rejectedProjects từ response
    } catch (error) {
      console.error("Lỗi khi tải danh sách công trình bị từ chối:", error.response?.data?.message || error.message);
      toast.error(error.response?.data?.message || 'Lỗi khi tải danh sách công trình bị từ chối!', { position: "top-center" });
      setRejectedProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchAuxData = async () => {
      try {
        const results = await Promise.allSettled([
          axios.get(`${API_URL}/api/allocated-units`),
          axios.get(`${API_URL}/api/allocation-waves`),
          axios.get(`${API_URL}/api/construction-units`),
          axios.get(`${API_URL}/api/users`),
          axios.get(`${API_URL}/api/project-types`), // Fetch project types
        ]);

        if (results[0].status === 'fulfilled') {
          // allocatedUnits
          const units = results[0].value.data || [];
          setAllocatedUnits(units.map(unit => typeof unit === 'object' && unit.name ? unit.name : String(unit)));
        } else {
          console.error("Lỗi tải Allocated Units:", results[0].reason);
          setAllocatedUnits([]);
        }

        if (results[1].status === 'fulfilled') {
          // allocationWavesList
          const waves = results[1].value.data || [];
          setAllocationWavesList(waves.map(wave => wave.name || String(wave)));
        } else {
          console.error("Lỗi tải Allocation Waves:", results[1].reason);
          setAllocationWavesList([]);
        }

        if (results[2].status === 'fulfilled') {
          // constructionUnitsList
          const constructionUnits = results[2].value.data || [];
          setConstructionUnitsList(constructionUnits.map(unit => typeof unit === 'object' && unit.name ? unit.name : String(unit)));
        } else {
          console.error("Lỗi tải Construction Units:", results[2].reason);
          setConstructionUnitsList([]);
        }

        if (results[3].status === 'fulfilled') {
          // usersList and approversList
          const usersData = results[3].value.data || [];
          // usersList cho filter và form sẽ chứa các object { _id, fullName }
          setUsersList(usersData.map(u => ({ _id: u._id, fullName: u.fullName || u.username || String(u) })));
          setApproversList(usersData.filter(u => u.permissions?.approve)); // Dùng cho form (cần cả object user)
        } else {
          console.error("Lỗi tải Users:", results[3].reason);
          setUsersList([]);
          setApproversList([]);
        }

        if (results[4].status === 'fulfilled') {
          // projectTypesList
          setProjectTypesList(results[4].value.data.map(type => type.name || String(type)));
        } else {
          console.error("Lỗi tải Project Types:", results[4].reason);
          setProjectTypesList([]);
        }
      } catch (error) {
        console.error("Lỗi không xác định khi tải dữ liệu phụ trợ:", error);
        toast.error('Lỗi không xác định khi tải dữ liệu phụ trợ!', { position: "top-center" });
        setAllocatedUnits([]);
        setAllocationWavesList([]);
        setConstructionUnitsList([]);
        setUsersList([]);
        setApproversList([]);
        setProjectTypesList([]);
      }
    };
    fetchAuxData();
  }, [user]);

  const debouncedFetchProjects = useCallback(
    debounce((page, sort, filterParams, isPending) => { // filterParams để ghi đè tạm thời nếu cần
      fetchProjects(page, sort, filterParams, isPending);
    }, 500),
    [fetchProjects] // fetchProjects đã có filters trong dependency của nó
  );

  // useEffect để fetch dữ liệu khi filters, currentPage, hoặc sortOrder thay đổi
  useEffect(() => {
    if (user) {
      // Gọi fetchProjects với filters hiện tại từ state
      fetchProjects(currentPage, sortOrder, {}, false);
    }
  }, [user, type, currentPage, sortOrder, filters, fetchProjects]); // Thêm filters vào dependency

  // useEffect để fetch dữ liệu pending và rejected khi component mount hoặc user thay đổi
  useEffect(() => {
    if (user) {
      fetchProjects(1, sortOrder, {}, true); // Fetch pending projects
      fetchRejectedProjects();

      if (!socket.connected) {
        socket.connect();
      }

      socket.on('project_deleted', ({ projectId, projectType }) => {
        if (projectType === type) {
          fetchProjects(currentPage, sortOrder, {}, false);
          fetchProjects(1, sortOrder, {}, true);
        }
      });

      socket.on('project_rejected', ({ projectId, projectType }) => {
        if (projectType === type) {
          fetchProjects(currentPage, sortOrder, {}, false);
          fetchProjects(1, sortOrder, {}, true);
          fetchRejectedProjects();
        }
      });
      
      socket.on('project_rejected_and_removed', ({ projectId, projectType }) => { // Thêm sự kiện này
        if (projectType === type) {
          fetchProjects(currentPage, sortOrder, {}, false);
          fetchProjects(1, sortOrder, {}, true);
          fetchRejectedProjects();
        }
      });

      socket.on('notification_processed', () => {
        fetchProjects(currentPage, sortOrder, {}, false);
        fetchProjects(1, sortOrder, {}, true);
      });

      return () => {
        socket.off('project_deleted');
        socket.off('project_rejected');
        socket.off('project_rejected_and_removed'); // Hủy đăng ký
        socket.off('notification_processed');
      };
    } else {
      setFilteredProjects([]);
      setPendingProjects([]);
      setRejectedProjects([]);
      setTotalPages(1);
      setCurrentPage(1);
      setTotalProjectsCount(0);
    }
  }, [user, type, sortOrder, fetchProjects, fetchRejectedProjects, currentPage]); // currentPage có thể không cần ở đây nếu fetchProjects đã xử lý


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
    setIsLoading(false);
    setIsSubmitting(false);
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
      supervisor: getUserId(project.supervisor), // Sẽ là _id
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
        estimator: getUserId(project.estimator), // Sẽ là _id
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
    setIsLoading(false);
    setIsSubmitting(false);
    setShowModal(true);
  };

  const saveProject = async () => {
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

    setIsSubmitting(true);
    let projectPayload = { ...formData, type }; // Sử dụng formData
    console.log("Dữ liệu gửi đi để lưu công trình:", projectPayload);

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
      // delete projectPayload.serial; // Backend sẽ tự tạo serial nếu không có
    }

    try {
      let response;
      let successMessage = '';
      let fetchPage = currentPage;

      if (editProject) {
        response = await axios.patch(`${API_URL}/api/projects/${editProject._id}?type=${type}`, projectPayload);
        successMessage = response.data.message || 'Đã cập nhật công trình thành công!';
        if (response.data?.project?.pendingEdit) { // Sửa ở đây để kiểm tra project.pendingEdit
          successMessage = 'Đã gửi yêu cầu sửa công trình!';
        }
      } else {
        response = await axios.post(`${API_URL}/api/projects`, projectPayload);
        successMessage = response.data.message || 'Đã đăng ký công trình thành công!';
        fetchPage = 1;
      }
      // Thông báo chỉ nên hiển thị "Chờ duyệt" nếu đó là trường hợp thực tế
      toast.success(successMessage + (response.data?.project?.pendingEdit || (!editProject && response.data?.project?.status === 'Chờ duyệt') ? ' Công trình đang ở trạng thái "Chờ duyệt".' : ''), { position: "top-center" });


      setFormData(initialFormData()); // Reset formData

      if (fetchPage !== currentPage) {
        setCurrentPage(fetchPage); // This will trigger useEffect to refetch
      } else {
        // If on the same page, manually refetch
        fetchProjects(fetchPage, sortOrder, {}, false);
        fetchProjects(1, sortOrder, {}, true); // Refetch pending
      }

      setShowModal(false);
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Lỗi khi lưu công trình!';
      console.error('Lỗi khi lưu công trình:', errorMessage, err.response?.data);
      toast.error(errorMessage, { position: "top-center" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const restoreRejectedProject = async (rejectedId, projectDetails, projectModel, originalProjectId, actionType) => {
    if (!window.confirm('Bạn có chắc chắn muốn khôi phục công trình này? Công trình sẽ được duyệt và chuyển vào danh sách chính.')) {
      return;
    }
    setIsSubmittingAction(true);
    try {
      const response = await axios.post(`${API_URL}/api/rejected-projects/${rejectedId}/restore`, {
        projectDetails,
        projectModel,
        originalProjectId,
        actionType
      });
      toast.success('Công trình đã được khôi phục và duyệt thành công!');
      fetchRejectedProjects(); // Tải lại danh sách bị từ chối
      fetchProjects(1, sortOrder, {}, false);
      if (user?.permissions?.approve) {
        fetchProjects(1, sortOrder, {}, true);
      }
    } catch (error) {
      console.error("Error restoring project:", error);
      toast.error(error.response?.data?.message || 'Lỗi khôi phục công trình.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const permanentlyDeleteRejectedProject = async (rejectedId) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn công trình bị từ chối này? Hành động này không thể hoàn tác.')) {
      setIsSubmittingAction(true);
      try {
        await axios.delete(`${API_URL}/api/rejected-projects/${rejectedId}`);
        toast.success('Công trình bị từ chối đã được xóa vĩnh viễn.');
        setRejectedProjects(prev => prev.filter(p => p._id !== rejectedId));
      } catch (error) {
        console.error("Error permanently deleting rejected project:", error);
        toast.error(error.response?.data?.message || 'Lỗi xóa vĩnh viễn công trình bị từ chối.');
      } finally {
        setIsSubmittingAction(false);
      }
    }
  };

  const handleActionWithConfirm = async (actionPromise, successMessage, confirmMessage = "Bạn có chắc chắn?") => {
    if (window.confirm(confirmMessage)) {
      setIsSubmittingAction(true); // Sử dụng isSubmittingAction
      try {
        const response = await actionPromise();
        toast.success(successMessage || response?.data?.message || "Thao tác thành công!", { position: "top-center" });
        // Sau khi hành động thành công, cần refetch dữ liệu cho cả 2 tab chính và pending
        fetchProjects(currentPage, sortOrder, {}, false); // Tải lại trang hiện tại của tab chính
        fetchProjects(1, sortOrder, {}, true); // Tải lại tab pending (thường bắt đầu từ trang 1)
      } catch (err) {
        console.error("Lỗi hành động:", err.response?.data?.message || err.message);
        toast.error(err.response?.data?.message || 'Thao tác thất bại!', { position: "top-center" });
      } finally {
        setIsSubmittingAction(false); // Sử dụng isSubmittingAction
      }
    }
  };

  const deleteProject = (id) =>
    handleActionWithConfirm(
      () => axios.delete(`${API_URL}/api/projects/${id}?type=${type}`),
      null, // Success message will come from backend or default in handleActionWithConfirm
      "Xác nhận Xóa hoặc gửi Yêu cầu xóa công trình này?"
    );

  const approveProject = (id) =>
    handleActionWithConfirm(
      () => axios.patch(`${API_URL}/api/projects/${id}/approve?type=${type}`),
      'Đã duyệt công trình!',
      "Xác nhận DUYỆT công trình này?"
    );

  const rejectProject = (id) => {
    const reason = prompt("Vui lòng nhập lý do từ chối:");
    if (reason === null) return; // User cancelled
    if (!reason || reason.trim() === "") {
      toast.error("Lý do từ chối không được để trống.");
      return;
    }
    handleActionWithConfirm(
      () => axios.patch(`${API_URL}/api/projects/${id}/reject?type=${type}`, { reason }),
      'Đã từ chối công trình!',
      "Xác nhận TỪ CHỐI công trình này?"
    );
  }


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

    handleActionWithConfirm(
      () => axios.patch(`${API_URL}/api/projects/${id}/allocate?type=${type}`, { constructionUnit: constructionUnit.trim(), allocationWave: allocationWave.trim() }),
      'Đã phân bổ công trình!',
      `Phân bổ cho ĐVTC "${constructionUnit.trim()}" (Đợt: "${allocationWave.trim()}")?`
    );
  };

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

    handleActionWithConfirm(
      () => axios.patch(`${API_URL}/api/projects/${id}/assign?type=${type}`, payload),
      'Đã giao việc cho công trình!',
      `Giao việc cho Giám sát ID: "${supervisor.trim()}"` + (isCategory && estimator && estimator.trim() ? ` và Dự toán ID: "${estimator.trim()}"` : "") + "?"
    );
  };


  const approveEditProject = (id) =>
    handleActionWithConfirm(
      () => axios.patch(`${API_URL}/api/projects/${id}/approve?type=${type}`), // Sửa URL ở đây
      'Đã duyệt yêu cầu sửa!',
      "Xác nhận DUYỆT yêu cầu sửa công trình này?"
    );

  const rejectEditProject = (id) => {
    const reason = prompt("Vui lòng nhập lý do từ chối yêu cầu sửa:");
    if (reason === null) return;
    if (!reason || reason.trim() === "") {
      toast.error("Lý do từ chối không được để trống.");
      return;
    }
    handleActionWithConfirm(
      () => axios.patch(`${API_URL}/api/projects/${id}/reject?type=${type}`, { reason }), // Backend dùng chung route /reject
      'Đã từ chối yêu cầu sửa.',
      "Xác nhận TỪ CHỐI yêu cầu sửa công trình này?"
    );
  }


  const approveDeleteProject = (id) =>
    handleActionWithConfirm(
      () => axios.patch(`${API_URL}/api/projects/${id}/approve?type=${type}`), // Backend dùng chung route /approve
      'Đã duyệt yêu cầu xóa.',
      "Xác nhận DUYỆT yêu cầu xóa công trình này?"
    );

  const rejectDeleteProject = (id) => {
    const reason = prompt("Vui lòng nhập lý do từ chối yêu cầu xóa:");
    if (reason === null) return;
    if (!reason || reason.trim() === "") {
      toast.error("Lý do từ chối không được để trống.");
      return;
    }
    handleActionWithConfirm(
      () => axios.patch(`${API_URL}/api/projects/${id}/reject?type=${type}`, { reason }), // Backend dùng chung route /reject
      'Đã từ chối yêu cầu xóa.',
      "Xác nhận TỪ CHỐI yêu cầu xóa công trình này?"
    );
  }


// Hàm mới: Lưu và refetch lại pendingProjects
// const editProjectAndRefetchPending = async () => { // This function seems unused, consider removing or implementing
//     await saveProject();
//     await fetchProjects(1, sortOrder, {}, true);
// };
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
    isLoading,
    isSubmittingAction, // Export isSubmittingAction
    isSubmitting,
    activeTab,
    setActiveTab,
    initialFormData,
    filters, // Export state filters mới
    setFilters, // Export setter cho state filters mới
    fetchProjects,
    fetchRejectedProjects,
    debouncedFetchProjects,
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
  };
}

export default ProjectManagementLogic;
