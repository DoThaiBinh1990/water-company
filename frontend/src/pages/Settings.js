// d:\CODE\water-company\frontend\src\pages\Settings.js
import { useState, useEffect } from 'react';
import { FaUserPlus, FaBuilding, FaHardHat, FaEdit, FaTrash, FaPlus, FaSync, FaUsers, FaList, FaProjectDiagram, FaUserCog, FaKey, FaCalendarAlt, FaCalendarTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getUsers, createUser as createUserAPI, updateUser as updateUserAPI, deleteUser as deleteUserAPI,
  getAllocatedUnits, createAllocatedUnit as createAllocatedUnitAPI, updateAllocatedUnit as updateAllocatedUnitAPI, deleteAllocatedUnit as deleteAllocatedUnitAPI,
  getConstructionUnits, createConstructionUnit as createConstructionUnitAPI, updateConstructionUnit as updateConstructionUnitAPI, deleteConstructionUnit as deleteConstructionUnitAPI,
  getAllocationWaves, createAllocationWave as createAllocationWaveAPI, updateAllocationWave as updateAllocationWaveAPI, deleteAllocationWave as deleteAllocationWaveAPI,
  getProjectTypes, createProjectType as createProjectTypeAPI, updateProjectType as updateProjectTypeAPI, deleteProjectType as deleteProjectTypeAPI,
  updateUserProfile as updateUserProfileAPI, changeUserPassword as changeUserPasswordAPI,
  syncProjectsData as syncProjectsAPI,
  getHolidaysForYearAPI, createOrUpdateHolidaysForYearAPI, deleteHolidayDateAPI
} from '../apiService';

const initialNewUserState = {
  username: '', password: '', role: 'staff-office', fullName: '',
  address: '', phoneNumber: '', email: '', unit: '',
  permissions: {
    add: true, edit: true, delete: true, approve: false, viewRejected: false,
    allocate: false, assign: false, // Đã loại bỏ khỏi giao diện chính
    viewOtherBranchProjects: false,
    assignProfileTimeline: false, assignConstructionTimeline: false,
  }
};

const getInitialActiveTab = () => {
  const persistedTab = localStorage.getItem('settingsActiveTab');
  // Danh sách các tab hợp lệ
  const validTabs = ['profile', 'users', 'allocatedUnits', 'constructionUnits', 'allocationWaves', 'projectTypes', 'syncProjects', 'holidays'];  
  // console.log('[Settings getInitialActiveTab] Persisted tab from localStorage:', persistedTab);
  if (persistedTab && validTabs.includes(persistedTab)) {
    return persistedTab;
  }
  // console.log('[Settings getInitialActiveTab] Defaulting to "profile"');
  return 'profile'; // Tab mặc định
};

function Settings({ user }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(getInitialActiveTab);

  const [newUser, setNewUser] = useState(initialNewUserState);
  const [editingUserId, setEditingUserId] = useState(null);

  const [newAllocatedUnitName, setNewAllocatedUnitName] = useState('');
  const [editAllocatedUnit, setEditAllocatedUnit] = useState(null);
  const [newConstructionUnitName, setNewConstructionUnitName] = useState('');
  const [editConstructionUnit, setEditConstructionUnit] = useState(null);
  const [newAllocationWaveName, setNewAllocationWaveName] = useState('');
  const [editAllocationWave, setEditAllocationWave] = useState(null);
  const [newProjectTypeName, setNewProjectTypeName] = useState('');
  const [editProjectType, setEditProjectType] = useState(null);

  const [userProfile, setUserProfile] = useState({
    fullName: user?.fullName || '',
    address: user?.address || '',
    phoneNumber: user?.phoneNumber || '',
    email: user?.email || '',
  });
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' });

  const [selectedHolidayYear, setSelectedHolidayYear] = useState(new Date().getFullYear());
  const [holidaysForSelectedYear, setHolidaysForSelectedYear] = useState([]);
  const [newHoliday, setNewHoliday] = useState({ date: '', description: '' });
  const [editingHoliday, setEditingHoliday] = useState(null); // { date: string, description: string }
  const [editingHolidayDescription, setEditingHolidayDescription] = useState('');

  const { data: users = [], isLoading: isLoadingUsers, isFetching: isFetchingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    enabled: user?.role === 'admin' && activeTab === 'users',
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi khi tải danh sách người dùng!', { position: "top-center" }),
  });

  const { data: allocatedUnits = [], isLoading: isLoadingAllocatedUnits, isFetching: isFetchingAllocatedUnits } = useQuery({
    queryKey: ['allocatedUnits'],
    queryFn: getAllocatedUnits,
    enabled: user?.role === 'admin' && (activeTab === 'allocatedUnits' || activeTab === 'users'),
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi khi tải đơn vị!', { position: "top-center" }),
  });

  const { data: constructionUnits = [], isLoading: isLoadingConstructionUnits, isFetching: isFetchingConstructionUnits } = useQuery({
    queryKey: ['constructionUnits'],
    queryFn: getConstructionUnits,
    enabled: user?.role === 'admin' && activeTab === 'constructionUnits',
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi khi tải đơn vị thi công!', { position: "top-center" }),
  });

  const { data: allocationWaves = [], isLoading: isLoadingAllocationWaves, isFetching: isFetchingAllocationWaves } = useQuery({
    queryKey: ['allocationWaves'],
    queryFn: getAllocationWaves,
    enabled: user?.role === 'admin' && activeTab === 'allocationWaves',
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi khi tải đợt phân bổ!', { position: "top-center" }),
  });

  const { data: projectTypes = [], isLoading: isLoadingProjectTypes, isFetching: isFetchingProjectTypes } = useQuery({
    queryKey: ['projectTypes'],
    queryFn: getProjectTypes,
    enabled: user?.role === 'admin' && activeTab === 'projectTypes',
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi khi tải loại công trình!', { position: "top-center" }),
  });

  // eslint-disable-next-line no-unused-vars
  const { data: holidaysDataFromQuery, isLoading: isLoadingHolidays, isFetching: isFetchingHolidays, refetch: refetchHolidays, status: holidaysQueryStatus } = useQuery({
    queryKey: ['holidays', selectedHolidayYear],
    queryFn: async () => {      
      console.log(`[Settings - holidaysQuery] Running queryFn for year: ${selectedHolidayYear}. User role: ${user?.role}. Active tab: ${activeTab}`);
      const data = await getHolidaysForYearAPI(selectedHolidayYear);
      // Log dữ liệu thô từ API TRƯỚC KHI xử lý
      console.log(`[Settings - holidaysQuery] RAW API response for year ${selectedHolidayYear}:`, JSON.stringify(data, null, 2));
      return data;
    },
    enabled: user?.role === 'admin' && activeTab === 'holidays',
    keepPreviousData: true,
    onSuccess: (data) => {
      console.log(`[Settings - onSuccess] START. For data.year: ${data?.year}. Current selectedHolidayYear: ${selectedHolidayYear}. data.holidays items: ${data?.holidays?.length}`);
      
      if (!data || data.year !== selectedHolidayYear) {
        console.warn(`[Settings - onSuccess] STALE DATA. data.year: ${data?.year}, selectedHolidayYear: ${selectedHolidayYear}. IGNORING.`);
        return;
      }

      if (!data || !data.holidays || !Array.isArray(data.holidays)) {
        console.warn(`[Settings - onSuccess] INVALID STRUCTURE for year ${data.year}. Expected { holidays: [] }. Received:`, data);
        setHolidaysForSelectedYear([]);
        return;
      }
      console.log(`[Settings - onSuccess] Processing data for year ${data.year}. Raw holidays:`, JSON.stringify(data.holidays, null, 2));

      try {
        const processedHolidays = data.holidays.map((h, itemIndex) => {
          if (!h || (!h.date)) {
            console.warn(`[Settings - map] Item ${itemIndex} for year ${data.year} is invalid or missing date:`, h);
            return null;
          }

          console.log(`[Settings - map] Processing item ${itemIndex} for year ${data.year}. Raw h.date: "${h.date}", type: ${typeof h.date}`);

          const dateObj = new Date(h.date);
          const isDateObjectInvalid = isNaN(dateObj.getTime());

          if (isDateObjectInvalid) {
            console.warn(`[Settings - map] Item ${itemIndex} for year ${data.year} - INVALID DATE OBJECT. h.date: "${h.date}". new Date(h.date) resulted in Invalid Date. Original item:`, h);
            return null;
          }
          console.log(`[Settings - map] Item ${itemIndex} for year ${data.year} - Date object OK: ${dateObj.toISOString()}`);

          const dateString = dateObj.toISOString().split('T')[0];
          const itemYearFromDate = parseInt(dateString.split('-')[0], 10);
          console.log(`[Settings - map] Item ${itemIndex} for year ${data.year} - Extracted year: ${itemYearFromDate}. API data.year: ${data.year}. dateString: "${dateString}"`);

          if (itemYearFromDate !== data.year) {
            console.warn(`[Settings - map] Item ${itemIndex} for year ${data.year} - YEAR MISMATCH. Extracted year ${itemYearFromDate} from dateString "${dateString}" (from h.date "${h.date}") does not match data.year ${data.year}. Skipping.`);
            return null;
          }

          return {
            _id: h._id,
            description: h.description,
            date: dateString,
          };
        }).filter(item => item !== null);
        
        console.log(`[Settings - onSuccess] FINAL processedHolidays for year ${data.year} (length ${processedHolidays.length}):`, JSON.stringify(processedHolidays, null, 2));
        setHolidaysForSelectedYear(processedHolidays);

      } catch (mapError) {
        console.error(`[Settings - onSuccess] CATCH_ERROR during mapping holidays for year ${data.year}:`, mapError);
        setHolidaysForSelectedYear([]);
      }
    },
    onError: (error) => {
      console.error(`[Settings - holidaysQuery onError] Error for year ${selectedHolidayYear}:`, error.response?.data?.message || error.message);
      toast.error(error.response?.data?.message || `Lỗi tải ngày nghỉ cho năm ${selectedHolidayYear}!`, { position: "top-center" });
      setHolidaysForSelectedYear([]);
    }
  });

  const isLoadingTabData =
    (activeTab === 'users' && (isLoadingUsers || isFetchingUsers)) ||
    (activeTab === 'allocatedUnits' && (isLoadingAllocatedUnits || isFetchingAllocatedUnits)) ||
    (activeTab === 'constructionUnits' && (isLoadingConstructionUnits || isFetchingConstructionUnits)) ||
    (activeTab === 'allocationWaves' && (isLoadingAllocationWaves || isFetchingAllocationWaves)) ||
    (activeTab === 'projectTypes' && (isLoadingProjectTypes || isFetchingProjectTypes)) ||
    (activeTab === 'holidays' && isLoadingHolidays);

  const useCreateGenericMutation = (mutationFn, queryKeyToInvalidate, successAddMsg, successEditMsg, resetFormFn) => {
    return useMutation({
      mutationFn,
      onSuccess: (data, variables) => {
        const isEditing = editingUserId || editAllocatedUnit || editConstructionUnit || editAllocationWave || editProjectType || (variables && (variables.userId || variables.unitId || variables.waveId || variables.typeId));
        toast.success(isEditing ? successEditMsg : successAddMsg, { position: "top-center" });
        if (queryKeyToInvalidate) {
            queryClient.invalidateQueries(queryKeyToInvalidate);
        }
        if (resetFormFn) resetFormFn();
      },
      onError: (error) => toast.error(error.response?.data?.message || 'Thao tác thất bại!', { position: "top-center" }),
    });
  };

  const validateUsername = (username) => /^[a-zA-Z0-9_]{3,20}$/.test(username);
  const validatePassword = (password) => password.length >= 6;

  const userMutation = useMutation({
    mutationFn: (userData) => {
      const dataToSubmit = { ...userData };
      if (editingUserId && !dataToSubmit.password) {
        delete dataToSubmit.password;
      }
      return editingUserId ? updateUserAPI({ userId: editingUserId, userData: dataToSubmit }) : createUserAPI(dataToSubmit);
    },
    onSuccess: () => {
      toast.success(editingUserId ? 'Đã cập nhật người dùng!' : 'Đã thêm người dùng!', { position: "top-center" });
      queryClient.invalidateQueries(['users']);
      setNewUser(initialNewUserState);
      setEditingUserId(null);
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi khi thao tác với người dùng!', { position: "top-center" }),
  });

  const saveUser = () => {
    if (!newUser.username || (!editingUserId && !newUser.password)) {
      return toast.error('Vui lòng nhập đầy đủ tên người dùng và mật khẩu!', { position: "top-center" });
    }
    if (!validateUsername(newUser.username)) {
      return toast.error('Tên người dùng phải dài 3-20 ký tự, chỉ chứa chữ cái, số và dấu gạch dưới!', { position: "top-center" });
    }
    if (!editingUserId && !validatePassword(newUser.password)) {
      return toast.error('Mật khẩu phải dài ít nhất 6 ký tự!', { position: "top-center" });
    }
    userMutation.mutate(newUser);
  };

  const editUserHandler = (userToEdit) => {
    setNewUser({
      username: userToEdit.username,
      password: '',
      role: userToEdit.role,
      fullName: userToEdit.fullName || '',
      address: userToEdit.address || '',
      phoneNumber: userToEdit.phoneNumber || '',
      email: userToEdit.email || '',
      unit: userToEdit.unit || '',
      permissions: {
        ...initialNewUserState.permissions, 
        ...(userToEdit.permissions || {}) 
      }
    });
    setEditingUserId(userToEdit._id);
  };

  const deleteUserMutation = useCreateGenericMutation(deleteUserAPI, ['users'], '', 'Đã xóa người dùng!', null);
  const deleteUserHandler = (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa người dùng này?')) {
      deleteUserMutation.mutate(id);
    }
  };

  const allocatedUnitMutation = useCreateGenericMutation(
    (unitData) => editAllocatedUnit ? updateAllocatedUnitAPI({ unitId: editAllocatedUnit._id, unitData }) : createAllocatedUnitAPI(unitData),
    ['allocatedUnits', 'users'],
    'Đã thêm đơn vị!', 'Đã cập nhật đơn vị!',
    () => { setNewAllocatedUnitName(''); setEditAllocatedUnit(null); }
  );
  const saveAllocatedUnit = () => {
    if (!newAllocatedUnitName.trim()) return toast.error('Vui lòng nhập tên đơn vị!', { position: "top-center" });
    allocatedUnitMutation.mutate({ name: newAllocatedUnitName.trim() });
  };
  const deleteAllocatedUnitMutation = useCreateGenericMutation(deleteAllocatedUnitAPI, ['allocatedUnits', 'users'], '', 'Đã xóa đơn vị!', null);
  const deleteAllocatedUnitHandler = (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa đơn vị này? Các user thuộc đơn vị này có thể bị ảnh hưởng.')) {
      deleteAllocatedUnitMutation.mutate(id);
    }
  };

  const constructionUnitMutation = useCreateGenericMutation(
    (unitData) => editConstructionUnit ? updateConstructionUnitAPI({ unitId: editConstructionUnit._id, unitData }) : createConstructionUnitAPI(unitData),
    ['constructionUnits'], 'Đã thêm đơn vị thi công!', 'Đã cập nhật đơn vị thi công!',
    () => { setNewConstructionUnitName(''); setEditConstructionUnit(null); }
  );
  const saveConstructionUnit = () => {
    if (!newConstructionUnitName.trim()) return toast.error('Vui lòng nhập tên đơn vị thi công!', { position: "top-center" });
    constructionUnitMutation.mutate({ name: newConstructionUnitName.trim() });
  };
  const deleteConstructionUnitMutation = useCreateGenericMutation(deleteConstructionUnitAPI, ['constructionUnits'], '', 'Đã xóa đơn vị thi công!', null);
  const deleteConstructionUnitHandler = (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa đơn vị thi công này?')) {
      deleteConstructionUnitMutation.mutate(id);
    }
  };

  const allocationWaveMutation = useCreateGenericMutation(
    (waveData) => editAllocationWave ? updateAllocationWaveAPI({ waveId: editAllocationWave._id, waveData }) : createAllocationWaveAPI(waveData),
    ['allocationWaves'], 'Đã thêm đợt phân bổ!', 'Đã cập nhật đợt phân bổ!',
    () => { setNewAllocationWaveName(''); setEditAllocationWave(null); }
  );
  const saveAllocationWave = () => {
    if (!newAllocationWaveName.trim()) return toast.error('Vui lòng nhập tên đợt phân bổ!', { position: "top-center" });
    allocationWaveMutation.mutate({ name: newAllocationWaveName.trim() });
  };
  const deleteAllocationWaveMutation = useCreateGenericMutation(deleteAllocationWaveAPI, ['allocationWaves'], '', 'Đã xóa đợt phân bổ!', null);
  const deleteAllocationWaveHandler = (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa đợt phân bổ này?')) {
      deleteAllocationWaveMutation.mutate(id);
    }
  };

  const projectTypeMutation = useCreateGenericMutation(
    (typeData) => editProjectType ? updateProjectTypeAPI({ typeId: editProjectType._id, typeData }) : createProjectTypeAPI(typeData),
    ['projectTypes'], 'Đã thêm loại công trình!', 'Đã cập nhật loại công trình!',
    () => { setNewProjectTypeName(''); setEditProjectType(null); }
  );
  const saveProjectType = () => {
    if (!newProjectTypeName.trim()) return toast.error('Vui lòng nhập tên loại công trình!', { position: "top-center" });
    projectTypeMutation.mutate({ name: newProjectTypeName.trim() });
  };
  const deleteProjectTypeMutation = useCreateGenericMutation(deleteProjectTypeAPI, ['projectTypes'], '', 'Đã xóa loại công trình!', null);
  const deleteProjectTypeHandler = (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa loại công trình này?')) {
      deleteProjectTypeMutation.mutate(id);
    }
  };

  const syncProjectsMutation = useMutation({
    mutationFn: syncProjectsAPI,
    onSuccess: (data) => {
      toast.success(data.message || 'Đồng bộ dữ liệu thành công!', { position: "top-center" });
      queryClient.invalidateQueries(['projects', 'category']);
      queryClient.invalidateQueries(['projects', 'minor_repair']);
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi khi đồng bộ dữ liệu công trình!', { position: "top-center" }),
  });
  const syncProjects = () => syncProjectsMutation.mutate();

  const updateUserProfileMutation = useMutation({
    mutationFn: updateUserProfileAPI,
    onSuccess: (data) => {
      toast.success(data.message || 'Cập nhật thông tin thành công!', { position: "top-center" });
      queryClient.invalidateQueries(['currentUser']);
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi cập nhật thông tin!', { position: "top-center" }),
  });

  const changePasswordMutation = useMutation({
    mutationFn: changeUserPasswordAPI,
    onSuccess: (data) => {
      toast.success(data.message || 'Đổi mật khẩu thành công!', { position: "top-center" });
      setPasswordData({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi đổi mật khẩu!', { position: "top-center" }),
  });

  const handleProfileUpdate = (e) => {
    e.preventDefault();
    updateUserProfileMutation.mutate(userProfile);
  };

  const handlePasswordChange = (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmNewPassword) {
      toast.error('Mật khẩu mới và xác nhận mật khẩu không khớp!', { position: "top-center" });
      return;
    }
    if (!validatePassword(passwordData.newPassword)) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự!', { position: "top-center" });
      return;
    }
    changePasswordMutation.mutate({
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword,
    });
  };

  const saveHolidaysMutation = useMutation({
    mutationFn: createOrUpdateHolidaysForYearAPI,
    onSuccess: (data, variables) => {
      toast.success(`Đã lưu ngày nghỉ cho năm ${selectedHolidayYear}!`, { position: "top-center" });
      queryClient.invalidateQueries({ queryKey: ['holidays', parseInt(variables.year, 10)] });
    },
    onError: (error) => toast.error(error.response?.data?.message || `Lỗi khi lưu ngày nghỉ cho năm ${selectedHolidayYear}!`, { position: "top-center" }),
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: deleteHolidayDateAPI,
    onSuccess: (data, variables) => {
      toast.success(data.message || 'Đã xóa ngày nghỉ!', { position: "top-center" });
      queryClient.invalidateQueries({ queryKey: ['holidays', parseInt(variables.year, 10)] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi khi xóa ngày nghỉ!', { position: "top-center" }),
  });

  const handleAddHoliday = () => {
    if (!newHoliday.date || !newHoliday.description) {
      toast.error('Vui lòng nhập ngày và mô tả cho ngày nghỉ.', { position: "top-center" });
      return;
    }
    if (holidaysForSelectedYear.some(h => h.date === newHoliday.date)) {
      toast.error(`Ngày ${newHoliday.date} đã tồn tại trong danh sách.`, { position: "top-center" });
      return;
    }

    const parts = newHoliday.date.split('-');
    const utcDate = new Date(Date.UTC(parseInt(parts[0],10), parseInt(parts[1],10) - 1, parseInt(parts[2],10)));
    const dayOfWeek = utcDate.getUTCDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      if (!window.confirm(`Ngày ${newHoliday.date} là Thứ ${dayOfWeek === 0 ? 'Chủ Nhật' : 'Bảy'}. Bạn vẫn muốn thêm làm ngày nghỉ lễ?`)) {
        return;
      }
    }

    const currentHolidays = holidaysForSelectedYear.map(h => ({ date: h.date, description: h.description }));
    const updatedHolidays = [...currentHolidays, { date: newHoliday.date, description: newHoliday.description }];
    saveHolidaysMutation.mutate({ year: selectedHolidayYear, holidays: updatedHolidays });
    setNewHoliday({ date: '', description: '' });
  };

  const handleStartEditHoliday = (holiday) => {
    setEditingHoliday(holiday);
    setEditingHolidayDescription(holiday.description);
  };

  const handleSaveEditedHoliday = () => {
    if (!editingHoliday || !editingHolidayDescription.trim()) {
      toast.error('Mô tả không được để trống.', { position: "top-center" });
      return;
    }
    const updatedHolidaysList = holidaysForSelectedYear.map(h =>
      h.date === editingHoliday.date ? { ...h, description: editingHolidayDescription.trim() } : h
    );
    const holidaysToSave = updatedHolidaysList.map(({ date, description }) => ({ date, description }));
    saveHolidaysMutation.mutate({ year: selectedHolidayYear, holidays: holidaysToSave });
    setEditingHoliday(null);
    setEditingHolidayDescription('');
  };

  const handleDeleteHoliday = (dateString) => {
    if (window.confirm(`Bạn có chắc muốn xóa ngày nghỉ ${dateString}?`)) {
      deleteHolidayMutation.mutate({ year: selectedHolidayYear, dateString });
      if (editingHoliday && editingHoliday.date === dateString) setEditingHoliday(null);
    }
  };

  const anyAdminMutationLoading =
    userMutation.isLoading || deleteUserMutation.isLoading ||
    allocatedUnitMutation.isLoading || deleteAllocatedUnitMutation.isLoading ||
    constructionUnitMutation.isLoading || deleteConstructionUnitMutation.isLoading ||
    allocationWaveMutation.isLoading || deleteAllocationWaveMutation.isLoading ||
    projectTypeMutation.isLoading || deleteProjectTypeMutation.isLoading ||
    saveHolidaysMutation.isLoading || deleteHolidayMutation.isLoading;

  const anyProfileMutationLoading = updateUserProfileMutation.isLoading || changePasswordMutation.isLoading;

  const handleRoleChange = (e) => {
    const role = e.target.value;
    let defaultPermissions = { ...initialNewUserState.permissions };

    switch (role) {
      case 'admin':
        defaultPermissions = { 
          add: true, edit: true, delete: true, approve: true, viewRejected: true, 
          allocate: true, assign: true, 
          viewOtherBranchProjects: true, 
          assignProfileTimeline: true, 
          assignConstructionTimeline: true
        };
        break;
      case 'director':
      case 'deputy_director':
      case 'manager-office':
        defaultPermissions = { add: true, edit: true, delete: true, approve: true, viewRejected: true, allocate: true, assign: true, viewOtherBranchProjects: true, assignProfileTimeline: true, assignConstructionTimeline: true };
        break;
      case 'deputy_manager-office':
        defaultPermissions = { add: true, edit: true, delete: true, approve: true, viewRejected: true, allocate: true, assign: true, viewOtherBranchProjects: true, assignProfileTimeline: true, assignConstructionTimeline: true };
        break;
      case 'staff-office':
        defaultPermissions = { add: true, edit: true, delete: true, approve: false, viewRejected: true, allocate: false, assign: false, viewOtherBranchProjects: true, assignProfileTimeline: false, assignConstructionTimeline: false };
        break;
      case 'manager-branch':
        defaultPermissions = { add: true, edit: true, delete: true, approve: true, viewRejected: true, allocate: true, assign: true, viewOtherBranchProjects: false, assignProfileTimeline: true, assignConstructionTimeline: true };
        break;
      case 'deputy_manager-branch':
        defaultPermissions = { add: true, edit: true, delete: true, approve: true, viewRejected: true, allocate: true, assign: true, viewOtherBranchProjects: false, assignProfileTimeline: true, assignConstructionTimeline: true };
        break;
      case 'staff-branch':
        defaultPermissions = { add: true, edit: true, delete: true, approve: false, viewRejected: false, allocate: false, assign: false, viewOtherBranchProjects: false, assignProfileTimeline: false, assignConstructionTimeline: false };
        break;
      case 'worker':
        defaultPermissions = { add: false, edit: false, delete: false, approve: false, viewRejected: false, allocate: false, assign: false, viewOtherBranchProjects: false, assignProfileTimeline: false, assignConstructionTimeline: false };
        break;
      default:
        defaultPermissions = { ...initialNewUserState.permissions };
    }
    const finalPermissions = { ...initialNewUserState.permissions };
    for (const key in defaultPermissions) {
        if (finalPermissions.hasOwnProperty(key)) {
            finalPermissions[key] = defaultPermissions[key];
        }
    }
    setNewUser(prev => ({ ...prev, role, permissions: finalPermissions }));
  };

  useEffect(() => {
    setUserProfile({
      fullName: user?.fullName || '',
      address: user?.address || '',
      phoneNumber: user?.phoneNumber || '',
      email: user?.email || '',
    });
  }, [user]);

  useEffect(() => {
    localStorage.setItem('settingsActiveTab', activeTab);
  }, [activeTab]);

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Thiết lập</h1>

      {(isLoadingTabData && !anyAdminMutationLoading && !anyProfileMutationLoading) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="text-white text-xl">Đang tải dữ liệu cài đặt...</div>
        </div>
      )}

      {syncProjectsMutation.isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="text-white text-xl">Đang đồng bộ dữ liệu công trình...</div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 border-b mb-6">
        <button onClick={() => setActiveTab('profile')} className={`py-2 px-4 flex items-center gap-2 text-sm font-medium transition-colors duration-150 ${activeTab === 'profile' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-blue-600'}`} disabled={anyAdminMutationLoading || anyProfileMutationLoading || syncProjectsMutation.isLoading || isLoadingTabData}><FaUserCog /> Thông tin cá nhân</button>
        {user?.role === 'admin' && (
          <>
            <button onClick={() => setActiveTab('users')} className={`py-2 px-4 flex items-center gap-2 text-sm font-medium transition-colors duration-150 ${activeTab === 'users' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-blue-600'}`} disabled={anyAdminMutationLoading || anyProfileMutationLoading || syncProjectsMutation.isLoading || isLoadingTabData}><FaUsers /> Quản lý người dùng</button>
            <button onClick={() => setActiveTab('allocatedUnits')} className={`py-2 px-4 flex items-center gap-2 text-sm font-medium transition-colors duration-150 ${activeTab === 'allocatedUnits' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-blue-600'}`} disabled={anyAdminMutationLoading || anyProfileMutationLoading || syncProjectsMutation.isLoading || isLoadingTabData}><FaBuilding /> Quản lý đơn vị</button>
            <button onClick={() => setActiveTab('constructionUnits')} className={`py-2 px-4 flex items-center gap-2 text-sm font-medium transition-colors duration-150 ${activeTab === 'constructionUnits' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-blue-600'}`} disabled={anyAdminMutationLoading || anyProfileMutationLoading || syncProjectsMutation.isLoading || isLoadingTabData}><FaHardHat /> Quản lý ĐVTC</button>
            <button onClick={() => setActiveTab('allocationWaves')} className={`py-2 px-4 flex items-center gap-2 text-sm font-medium transition-colors duration-150 ${activeTab === 'allocationWaves' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-blue-600'}`} disabled={anyAdminMutationLoading || anyProfileMutationLoading || syncProjectsMutation.isLoading || isLoadingTabData}><FaList /> Quản lý đợt PB</button>
            <button onClick={() => setActiveTab('projectTypes')} className={`py-2 px-4 flex items-center gap-2 text-sm font-medium transition-colors duration-150 ${activeTab === 'projectTypes' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-blue-600'}`} disabled={anyAdminMutationLoading || anyProfileMutationLoading || syncProjectsMutation.isLoading || isLoadingTabData}><FaProjectDiagram /> Quản lý loại CT</button>
            <button onClick={() => setActiveTab('syncProjects')} className={`py-2 px-4 flex items-center gap-2 text-sm font-medium transition-colors duration-150 ${activeTab === 'syncProjects' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-blue-600'}`} disabled={anyAdminMutationLoading || anyProfileMutationLoading || syncProjectsMutation.isLoading || isLoadingTabData}><FaSync /> Đồng bộ dữ liệu</button>
            <button onClick={() => setActiveTab('holidays')} className={`py-2 px-4 flex items-center gap-2 text-sm font-medium transition-colors duration-150 ${activeTab === 'holidays' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-blue-600'}`} disabled={anyAdminMutationLoading || anyProfileMutationLoading || syncProjectsMutation.isLoading || isLoadingTabData}><FaCalendarAlt /> Quản lý Ngày nghỉ</button>
          </>
        )}
      </div>

      {activeTab === 'profile' && (
        <div className="bg-white p-8 rounded-2xl shadow-md">
          <form onSubmit={handleProfileUpdate}>
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2"><FaUserCog /> Cập nhật thông tin cá nhân</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div><label className="block text-gray-700 mb-2">Họ và tên</label><input type="text" value={userProfile.fullName} onChange={(e) => setUserProfile(prev => ({ ...prev, fullName: e.target.value }))} className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={updateUserProfileMutation.isLoading} /></div>
              <div><label className="block text-gray-700 mb-2">Địa chỉ</label><input type="text" value={userProfile.address} onChange={(e) => setUserProfile(prev => ({ ...prev, address: e.target.value }))} className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={updateUserProfileMutation.isLoading} /></div>
              <div><label className="block text-gray-700 mb-2">Số điện thoại</label><input type="text" value={userProfile.phoneNumber} onChange={(e) => setUserProfile(prev => ({ ...prev, phoneNumber: e.target.value }))} className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={updateUserProfileMutation.isLoading} /></div>
              <div><label className="block text-gray-700 mb-2">Email</label><input type="email" value={userProfile.email} onChange={(e) => setUserProfile(prev => ({ ...prev, email: e.target.value }))} className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={updateUserProfileMutation.isLoading} /></div>
            </div>
            <button type="submit" className={`bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 ${updateUserProfileMutation.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={updateUserProfileMutation.isLoading}>
              {updateUserProfileMutation.isLoading ? 'Đang lưu...' : 'Lưu thay đổi thông tin'}
            </button>
          </form>

          <hr className="my-8 border-gray-300" />

          <form onSubmit={handlePasswordChange}>
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2"><FaKey /> Đổi mật khẩu</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div><label className="block text-gray-700 mb-2">Mật khẩu hiện tại</label><input type="password" value={passwordData.currentPassword} onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))} className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required disabled={changePasswordMutation.isLoading} /></div>
              <div><label className="block text-gray-700 mb-2">Mật khẩu mới</label><input type="password" value={passwordData.newPassword} onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))} className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required disabled={changePasswordMutation.isLoading} /></div>
              <div><label className="block text-gray-700 mb-2">Xác nhận mật khẩu mới</label><input type="password" value={passwordData.confirmNewPassword} onChange={(e) => setPasswordData(prev => ({ ...prev, confirmNewPassword: e.target.value }))} className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required disabled={changePasswordMutation.isLoading} /></div>
            </div>
            <button type="submit" className={`bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 ${changePasswordMutation.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={changePasswordMutation.isLoading}>
              {changePasswordMutation.isLoading ? 'Đang đổi...' : 'Đổi mật khẩu'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'users' && user?.role === 'admin' && (
        <div className="bg-white p-8 rounded-2xl shadow-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">{editingUserId ? 'Cập nhật người dùng' : 'Thêm người dùng'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div><label className="block text-gray-700 mb-2">Tên người dùng</label><input type="text" placeholder="Nhập tên người dùng (3-20 ký tự)" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={userMutation.isLoading} maxLength={20} /></div>
            <div><label className="block text-gray-700 mb-2">Mật khẩu</label><input type="password" placeholder={editingUserId ? 'Để trống nếu không đổi' : 'Nhập mật khẩu (tối thiểu 6 ký tự)'} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={userMutation.isLoading} maxLength={50} /></div>
            <div><label className="block text-gray-700 mb-2">Họ và tên</label><input type="text" placeholder="Nhập họ và tên" value={newUser.fullName} onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })} className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={userMutation.isLoading} maxLength={50} /></div>
            <div><label className="block text-gray-700 mb-2">Địa chỉ</label><input type="text" placeholder="Nhập địa chỉ" value={newUser.address} onChange={(e) => setNewUser({ ...newUser, address: e.target.value })} className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={userMutation.isLoading} maxLength={100} /></div>
            <div><label className="block text-gray-700 mb-2">Số điện thoại</label><input type="text" placeholder="Nhập số điện thoại" value={newUser.phoneNumber} onChange={(e) => setNewUser({ ...newUser, phoneNumber: e.target.value })} className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={userMutation.isLoading} maxLength={15} /></div>
            <div><label className="block text-gray-700 mb-2">Email</label><input type="email" placeholder="Nhập email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={userMutation.isLoading} maxLength={50} /></div>
            <div>
              <label className="block text-gray-700 mb-2">Đơn vị/Chi nhánh</label>
              <select value={newUser.unit} onChange={(e) => setNewUser({ ...newUser, unit: e.target.value })} className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={userMutation.isLoading || isLoadingAllocatedUnits}>
                <option value="">Chọn đơn vị/chi nhánh</option>
                {allocatedUnits.map((unit, index) => (<option key={unit._id || index} value={unit.name}>{unit.name}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Vai trò</label>
              <select value={newUser.role} onChange={handleRoleChange} className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={userMutation.isLoading}>
                <option value="admin">Admin</option>
                <option value="director">Tổng giám đốc</option>
                <option value="deputy_director">Phó tổng giám đốc</option>
                <option value="manager-office">Trưởng phòng (Công ty)</option>
                <option value="deputy_manager-office">Phó phòng (Công ty)</option>
                <option value="staff-office">Nhân viên (Phòng Công ty)</option>
                <option value="manager-branch">Giám đốc (Chi nhánh)</option>
                <option value="deputy_manager-branch">Phó giám đốc (Chi nhánh)</option>
                <option value="staff-branch">Nhân viên (Chi nhánh)</option>
                <option value="worker">Công nhân</option>
              </select>
            </div>
          </div>
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Phân quyền chi tiết</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.keys(initialNewUserState.permissions)
                .filter(permKey => permKey !== 'allocate' && permKey !== 'assign')
                .map(permKey => (
                <label key={permKey} className="flex items-center">
                  <input type="checkbox" checked={newUser.permissions[permKey] || false} onChange={(e) => setNewUser(prev => ({ ...prev, permissions: { ...prev.permissions, [permKey]: e.target.checked } }))} className="mr-2 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" disabled={userMutation.isLoading || newUser.role === 'admin'} />
                  {permKey === 'add' && 'Thêm CT'}
                  {permKey === 'edit' && 'Sửa CT'}
                  {permKey === 'delete' && 'Xóa CT'}
                  {permKey === 'approve' && 'Duyệt CT'}
                  {permKey === 'viewRejected' && 'Xem CT Từ Chối'}
                  {permKey === 'assignProfileTimeline' && 'Phân công TL Hồ sơ'}
                  {permKey === 'assignConstructionTimeline' && 'Phân công TL Thi công'}
                  {permKey === 'viewOtherBranchProjects' && 'Xem CT chi nhánh khác'}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={saveUser} className={`bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-md ${userMutation.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={userMutation.isLoading}><FaUserPlus /> {editingUserId ? 'Cập nhật' : 'Thêm'}</button>
            {editingUserId && (<button onClick={() => { setNewUser(initialNewUserState); setEditingUserId(null); }} className={`bg-gray-600 text-white p-3 rounded-lg hover:bg-gray-700 ${userMutation.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={userMutation.isLoading}>Hủy</button>)}
          </div>
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Danh sách người dùng</h2>
            <div className="overflow-x-auto">
              <table className="w-full table-auto border-collapse">
                <thead>
                  <tr className="bg-blue-50"><th className="p-4 text-left text-gray-700 font-bold border-b">Tên người dùng</th><th className="p-4 text-left text-gray-700 font-bold border-b">Họ và tên</th><th className="p-4 text-left text-gray-700 font-bold border-b">Đơn vị</th><th className="p-4 text-left text-gray-700 font-bold border-b">Vai trò</th><th className="p-4 text-left text-gray-700 font-bold border-b">Quyền</th><th className="p-4 text-left text-gray-700 font-bold border-b">Hành động</th></tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u._id} className="border-t hover:bg-blue-50">
                      <td className="p-4 text-gray-700">{u.username}</td><td className="p-4 text-gray-700">{u.fullName || 'N/A'}</td><td className="p-4 text-gray-700">{u.unit || 'N/A'}</td>
                      <td className="p-4 text-gray-700">
                        {u.role === 'admin' && 'Admin'}
                        {u.role === 'director' && 'Tổng giám đốc'}
                        {u.role === 'deputy_director' && 'Phó tổng giám đốc'}
                        {u.role === 'manager-office' && 'Trưởng phòng (CT)'}
                        {u.role === 'deputy_manager-office' && 'Phó phòng (CT)'}
                        {u.role === 'staff-office' && 'Nhân viên (Phòng CT)'}
                        {u.role === 'manager-branch' && 'Giám đốc (CN)'}
                        {u.role === 'deputy_manager-branch' && 'Phó giám đốc (CN)'}
                        {u.role === 'staff-branch' && 'Nhân viên (CN)'}
                        {u.role === 'worker' && 'Công nhân'}
                      </td>
                      <td className="p-4 text-gray-700 text-xs">
                        {Object.entries(u.permissions || {})
                          .filter(([, value]) => value)
                          .map(([key]) => ({
                            add: 'Thêm', edit: 'Sửa', delete: 'Xóa', approve: 'Duyệt', viewRejected: 'Xem TC',
                            assignProfileTimeline: 'PCTL HS', assignConstructionTimeline: 'PCTL TC',
                            viewOtherBranchProjects: 'XemCNKhác'
                          }[key] || key.replace('assign', 'PC').replace('Timeline','TL').replace('Profile','HS').replace('Construction','TC')))
                          .join(', ')}
                      </td>
                      <td className="p-4 flex gap-2">
                        <button onClick={() => editUserHandler(u)} className="text-blue-600 hover:text-blue-800 disabled:opacity-50" disabled={userMutation.isLoading || deleteUserMutation.isLoading}><FaEdit size={16} /></button>
                        <button onClick={() => deleteUserHandler(u._id)} className="text-red-600 hover:text-red-800 disabled:opacity-50" disabled={userMutation.isLoading || deleteUserMutation.isLoading || u.role === 'admin'}><FaTrash size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'allocatedUnits' && user?.role === 'admin' && ( <div className="bg-white p-8 rounded-2xl shadow-md"> <h2 className="text-2xl font-bold text-gray-800 mb-6">Quản lý đơn vị</h2> <div className="flex flex-col md:flex-row gap-4 mb-6"> <div className="flex-1"> <label className="block text-gray-700 mb-2">Tên đơn vị</label> <input type="text" placeholder="Nhập tên đơn vị" value={newAllocatedUnitName} onChange={(e) => setNewAllocatedUnitName(e.target.value)} className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={allocatedUnitMutation.isLoading} maxLength={50} /> </div> <div className="flex items-end gap-4"> <button onClick={saveAllocatedUnit} className={`bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-md ${allocatedUnitMutation.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={allocatedUnitMutation.isLoading}><FaBuilding /> {editAllocatedUnit ? 'Cập nhật' : 'Thêm'}</button> {editAllocatedUnit && (<button onClick={() => { setNewAllocatedUnitName(''); setEditAllocatedUnit(null); }} className={`bg-gray-600 text-white p-3 rounded-lg hover:bg-gray-700 ${allocatedUnitMutation.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={allocatedUnitMutation.isLoading}>Hủy</button>)} </div> </div> <div className="overflow-x-auto"> <table className="w-full table-auto border-collapse"> <thead> <tr className="bg-blue-50"><th className="p-4 text-left text-gray-700 font-bold border-b">Tên đơn vị</th><th className="p-4 text-left text-gray-700 font-bold border-b">Hành động</th></tr> </thead> <tbody> {allocatedUnits.map(unit => (<tr key={unit._id} className="border-t hover:bg-blue-50"><td className="p-4 text-gray-700">{unit.name}</td><td className="p-4 flex gap-2"><button onClick={() => { setNewAllocatedUnitName(unit.name); setEditAllocatedUnit(unit);}} className="text-blue-600 hover:text-blue-800 disabled:opacity-50" disabled={allocatedUnitMutation.isLoading || deleteAllocatedUnitMutation.isLoading}><FaEdit size={16} /></button><button onClick={() => deleteAllocatedUnitHandler(unit._id)} className="text-red-600 hover:text-red-800 disabled:opacity-50" disabled={allocatedUnitMutation.isLoading || deleteAllocatedUnitMutation.isLoading}><FaTrash size={16} /></button></td></tr>))} </tbody> </table> </div> </div>)}
      {activeTab === 'constructionUnits' && user?.role === 'admin' && ( <div className="bg-white p-8 rounded-2xl shadow-md"> <h2 className="text-2xl font-bold text-gray-800 mb-6">Quản lý đơn vị thi công</h2> <div className="flex flex-col md:flex-row gap-4 mb-6"> <div className="flex-1"> <label className="block text-gray-700 mb-2">Tên đơn vị thi công</label> <input type="text" placeholder="Nhập tên đơn vị thi công" value={newConstructionUnitName} onChange={(e) => setNewConstructionUnitName(e.target.value)} className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={constructionUnitMutation.isLoading} maxLength={50} /> </div> <div className="flex items-end gap-4"> <button onClick={saveConstructionUnit} className={`bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-md ${constructionUnitMutation.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={constructionUnitMutation.isLoading}><FaHardHat /> {editConstructionUnit ? 'Cập nhật' : 'Thêm'}</button> {editConstructionUnit && (<button onClick={() => { setNewConstructionUnitName(''); setEditConstructionUnit(null);}} className={`bg-gray-600 text-white p-3 rounded-lg hover:bg-gray-700 ${constructionUnitMutation.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={constructionUnitMutation.isLoading}>Hủy</button>)} </div> </div> <div className="overflow-x-auto"> <table className="w-full table-auto border-collapse"> <thead> <tr className="bg-blue-50"><th className="p-4 text-left text-gray-700 font-bold border-b">Tên đơn vị</th><th className="p-4 text-left text-gray-700 font-bold border-b">Hành động</th></tr> </thead> <tbody> {constructionUnits.map(unit => (<tr key={unit._id} className="border-t hover:bg-blue-50"><td className="p-4 text-gray-700">{unit.name}</td><td className="p-4 flex gap-2"><button onClick={() => { setNewConstructionUnitName(unit.name); setEditConstructionUnit(unit);}} className="text-blue-600 hover:text-blue-800 disabled:opacity-50" disabled={constructionUnitMutation.isLoading || deleteConstructionUnitMutation.isLoading}><FaEdit size={16} /></button><button onClick={() => deleteConstructionUnitHandler(unit._id)} className="text-red-600 hover:text-red-800 disabled:opacity-50" disabled={constructionUnitMutation.isLoading || deleteConstructionUnitMutation.isLoading}><FaTrash size={16} /></button></td></tr>))} </tbody> </table> </div> </div>)}
      {activeTab === 'allocationWaves' && user?.role === 'admin' && ( <div className="bg-white p-8 rounded-2xl shadow-md"> <h2 className="text-2xl font-bold text-gray-800 mb-6">Quản lý đợt phân bổ</h2> <div className="flex flex-col md:flex-row gap-4 mb-6"> <div className="flex-1"> <label className="block text-gray-700 mb-2">Tên đợt phân bổ</label> <input type="text" placeholder="Nhập tên đợt phân bổ" value={newAllocationWaveName} onChange={(e) => setNewAllocationWaveName(e.target.value)} className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={allocationWaveMutation.isLoading} maxLength={50} /> </div> <div className="flex items-end gap-4"> <button onClick={saveAllocationWave} className={`bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-md ${allocationWaveMutation.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={allocationWaveMutation.isLoading}><FaPlus /> {editAllocationWave ? 'Cập nhật' : 'Thêm'}</button> {editAllocationWave && (<button onClick={() => { setNewAllocationWaveName(''); setEditAllocationWave(null);}} className={`bg-gray-600 text-white p-3 rounded-lg hover:bg-gray-700 ${allocationWaveMutation.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={allocationWaveMutation.isLoading}>Hủy</button>)} </div> </div> <div className="overflow-x-auto"> <table className="w-full table-auto border-collapse"> <thead> <tr className="bg-blue-50"><th className="p-4 text-left text-gray-700 font-bold border-b">Tên đợt phân bổ</th><th className="p-4 text-left text-gray-700 font-bold border-b">Hành động</th></tr> </thead> <tbody> {allocationWaves.map(wave => (<tr key={wave._id} className="border-t hover:bg-blue-50"><td className="p-4 text-gray-700">{wave.name}</td><td className="p-4 flex gap-2"><button onClick={() => { setNewAllocationWaveName(wave.name); setEditAllocationWave(wave);}} className="text-blue-600 hover:text-blue-800 disabled:opacity-50" disabled={allocationWaveMutation.isLoading || deleteAllocationWaveMutation.isLoading}><FaEdit size={16} /></button><button onClick={() => deleteAllocationWaveHandler(wave._id)} className="text-red-600 hover:text-red-800 disabled:opacity-50" disabled={allocationWaveMutation.isLoading || deleteAllocationWaveMutation.isLoading}><FaTrash size={16} /></button></td></tr>))} </tbody> </table> </div> </div>)}
      {activeTab === 'projectTypes' && user?.role === 'admin' && ( <div className="bg-white p-8 rounded-2xl shadow-md"> <h2 className="text-2xl font-bold text-gray-800 mb-6">Quản lý loại công trình</h2> <div className="flex flex-col md:flex-row gap-4 mb-6"> <div className="flex-1"> <label className="block text-gray-700 mb-2">Tên loại công trình</label> <input type="text" placeholder="Nhập tên loại công trình" value={newProjectTypeName} onChange={(e) => setNewProjectTypeName(e.target.value)} className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={projectTypeMutation.isLoading} maxLength={50} /> </div> <div className="flex items-end gap-4"> <button onClick={saveProjectType} className={`bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-md ${projectTypeMutation.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={projectTypeMutation.isLoading}><FaPlus /> {editProjectType ? 'Cập nhật' : 'Thêm'}</button> {editProjectType && (<button onClick={() => { setNewProjectTypeName(''); setEditProjectType(null);}} className={`bg-gray-600 text-white p-3 rounded-lg hover:bg-gray-700 ${projectTypeMutation.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={projectTypeMutation.isLoading}>Hủy</button>)} </div> </div> <div className="overflow-x-auto"> <table className="w-full table-auto border-collapse"> <thead> <tr className="bg-blue-50"><th className="p-4 text-left text-gray-700 font-bold border-b">Tên loại công trình</th><th className="p-4 text-left text-gray-700 font-bold border-b">Hành động</th></tr> </thead> <tbody> {projectTypes.map(type => (<tr key={type._id} className="border-t hover:bg-blue-50"><td className="p-4 text-gray-700">{type.name}</td><td className="p-4 flex gap-2"><button onClick={() => { setNewProjectTypeName(type.name); setEditProjectType(type);}} className="text-blue-600 hover:text-blue-800 disabled:opacity-50" disabled={projectTypeMutation.isLoading || deleteProjectTypeMutation.isLoading}><FaEdit size={16} /></button><button onClick={() => deleteProjectTypeHandler(type._id)} className="text-red-600 hover:text-red-800 disabled:opacity-50" disabled={projectTypeMutation.isLoading || deleteProjectTypeMutation.isLoading}><FaTrash size={16} /></button></td></tr>))} </tbody> </table> </div> </div>)}
      {activeTab === 'syncProjects' && user?.role === 'admin' && ( <div className="bg-white p-8 rounded-2xl shadow-md"> <h2 className="text-2xl font-bold text-gray-800 mb-6">Đồng bộ dữ liệu công trình</h2> <p className="text-gray-600 mb-4"> Chức năng này sẽ đồng bộ dữ liệu công trình từ collection cũ (<code>projects</code>) sang các collection mới (<code>categoryprojects</code> và <code>minorrepairprojects</code>). <br /> <strong>Lưu ý:</strong> Hành động này sẽ cập nhật hoặc thêm mới các công trình dựa trên dữ liệu cũ, giữ nguyên các công trình đã có trong collection mới nếu không có thay đổi. </p> <button onClick={() => { if (window.confirm('Bạn có chắc chắn muốn đồng bộ dữ liệu công trình?')) { syncProjects(); } }} className={`bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 flex items-center gap-2 shadow-md ${syncProjectsMutation.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={syncProjectsMutation.isLoading}><FaSync /> Đồng bộ dữ liệu công trình</button> </div>)}
      
      {activeTab === 'holidays' && user?.role === 'admin' && (
        <div className="bg-white p-8 rounded-2xl shadow-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Quản lý Ngày nghỉ Lễ</h2>
          <div className="mb-6">
            <label className="block text-gray-700 mb-2">Chọn năm tài chính:</label>
            <select 
              value={selectedHolidayYear} 
              onChange={(e) => setSelectedHolidayYear(parseInt(e.target.value, 10))} 
              className="w-full md:w-1/3 border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
              disabled={saveHolidaysMutation.isLoading || deleteHolidayMutation.isLoading || isLoadingHolidays}
            >
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-gray-700 mb-1">Ngày (YYYY-MM-DD)</label>
              <input 
                type="date" 
                value={newHoliday.date} 
                onChange={(e) => setNewHoliday(prev => ({ ...prev, date: e.target.value }))} 
                className="w-full border border-gray-300 p-2 rounded-lg" 
                disabled={saveHolidaysMutation.isLoading} 
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-gray-700 mb-1">Mô tả</label>
              <input 
                type="text" 
                placeholder="Mô tả ngày nghỉ" 
                value={newHoliday.description} 
                onChange={(e) => setNewHoliday(prev => ({ ...prev, description: e.target.value }))} 
                className="w-full border border-gray-300 p-2 rounded-lg" 
                disabled={saveHolidaysMutation.isLoading} 
              />
            </div>
          </div>
          <button 
            onClick={handleAddHoliday} 
            className={`bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 flex items-center gap-2 mb-6 ${saveHolidaysMutation.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} 
            disabled={saveHolidaysMutation.isLoading}
          >
            <FaPlus /> Thêm ngày nghỉ
          </button>

          <h3 className="text-xl font-semibold text-gray-700 mb-4">Danh sách ngày nghỉ năm {selectedHolidayYear}</h3>
          {isLoadingHolidays && <p>Đang tải ngày nghỉ...</p>}
          {!isLoadingHolidays && holidaysForSelectedYear.length === 0 && (
            <p className="text-gray-500">
              Chưa có ngày nghỉ nào được thiết lập cho năm {selectedHolidayYear}.
              (Raw API items: {holidaysDataFromQuery?.holidays?.length || 0}, Processed items: {holidaysForSelectedYear.length})
            </p>
          )}
          {!isLoadingHolidays && holidaysForSelectedYear.length > 0 && (
            <ul className="space-y-2">
              {holidaysForSelectedYear.map((holiday, index) => (
                <li key={holiday._id || holiday.date || index} className="p-3 bg-gray-50 rounded-md border">
                  {editingHoliday && editingHoliday.date === holiday.date ? (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{new Date(holiday.date + "T00:00:00Z").toLocaleDateString('vi-VN')} - </span>
                      <input
                        type="text"
                        value={editingHolidayDescription}
                        onChange={(e) => setEditingHolidayDescription(e.target.value)}
                        className="form-input text-sm flex-grow rounded-md"
                        disabled={saveHolidaysMutation.isLoading}
                      />
                      <button onClick={handleSaveEditedHoliday} className="btn btn-success btn-sm" disabled={saveHolidaysMutation.isLoading}>Lưu</button>
                      <button onClick={() => setEditingHoliday(null)} className="btn btn-secondary btn-sm" disabled={saveHolidaysMutation.isLoading}>Hủy</button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium text-gray-800">{new Date(holiday.date + "T00:00:00Z").toLocaleDateString('vi-VN')}</span>
                        <span className="text-gray-600 ml-2">- {holiday.description}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleStartEditHoliday(holiday)} className="text-blue-500 hover:text-blue-700 disabled:opacity-50" disabled={deleteHolidayMutation.isLoading || saveHolidaysMutation.isLoading}>
                          <FaEdit size={16} />
                        </button>
                        <button onClick={() => handleDeleteHoliday(holiday.date)} className="text-red-500 hover:text-red-700 disabled:opacity-50" disabled={deleteHolidayMutation.isLoading || saveHolidaysMutation.isLoading}>
                          <FaCalendarTimes size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default Settings;
