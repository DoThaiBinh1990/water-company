// d:\CODE\water-company\frontend\src\pages\Settings.js
import { useState, useEffect, useMemo } from 'react';
import { FaUserPlus, FaBuilding, FaHardHat, FaEdit, FaTrash, FaPlus, FaSync, FaUsers, FaList, FaProjectDiagram, FaUserCog, FaKey, FaCalendarAlt, FaCalendarTimes, FaListAlt } from 'react-icons/fa'; // Thêm FaListAlt
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
  prepareSyncDataAPI,
  executeSyncDataAPI,
  getHolidaysForYearAPI, addHolidayAPI, updateHolidayAPI, deleteHolidayDateAPI
} from '../apiService';

import SyncReviewModal from '../components/Settings/SyncReviewModal';
import { useMediaQuery } from '../hooks/useMediaQuery';
import ProjectCodeStandardization from '../components/Settings/ProjectCodeStandardization'; // Import component mới
import Pagination from '../components/Common/Pagination';

const initialNewUserState = {
  username: '', password: '', role: 'staff-office', fullName: '',
  address: '', phoneNumber: '', email: '', unit: '',
  permissions: {
    add: true, edit: true, delete: true, approve: false, viewRejected: false,
    allocate: false, assign: false,
    viewOtherBranchProjects: false,
    assignProfileTimeline: false, assignConstructionTimeline: false,
  }
};

const getInitialActiveTab = () => {
  const persistedTab = localStorage.getItem('settingsActiveTab');
  const validTabs = ['profile', 'users', 'allocatedUnits', 'constructionUnits', 'allocationWaves', 'projectTypes', 'syncProjects', 'holidays', 'standardizeCodes']; // Thêm standardizeCodes
  if (persistedTab && validTabs.includes(persistedTab)) {
    return persistedTab;
  }
  return 'profile';
};

function Settings({ user }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(getInitialActiveTab);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const itemsPerPage = 10;

  const [currentPageUsers, setCurrentPageUsers] = useState(1);
  const [currentPageAllocatedUnits, setCurrentPageAllocatedUnits] = useState(1);
  const [currentPageConstructionUnits, setCurrentPageConstructionUnits] = useState(1);
  const [currentPageAllocationWaves, setCurrentPageAllocationWaves] = useState(1);
  const [currentPageProjectTypes, setCurrentPageProjectTypes] = useState(1);

  const [newUser, setNewUser] = useState(initialNewUserState);
  const [editingUserId, setEditingUserId] = useState(null);

  const [newAllocatedUnitName, setNewAllocatedUnitName] = useState('');
  const [newAllocatedUnitShortCode, setNewAllocatedUnitShortCode] = useState('');
  const [editAllocatedUnit, setEditAllocatedUnit] = useState(null);
  const [newConstructionUnitName, setNewConstructionUnitName] = useState('');
  const [editConstructionUnit, setEditConstructionUnit] = useState(null);
  const [newAllocationWaveName, setNewAllocationWaveName] = useState('');
  const [newAllocationWaveShortCode, setNewAllocationWaveShortCode] = useState(''); // State cho shortCode của Đợt PB
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
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [editingHolidayDescription, setEditingHolidayDescription] = useState('');

  const [expandedUserId, setExpandedUserId] = useState(null); // State cho user card
  const [selectedSyncYear, setSelectedSyncYear] = useState(String(new Date().getFullYear()));
  const [selectedSyncProjectType, setSelectedSyncProjectType] = useState('all');
  const [showSyncReviewModal, setShowSyncReviewModal] = useState(false);
  const [preparedSyncData, setPreparedSyncData] = useState([]);

  const { data: users = [], isLoading: isLoadingUsers, isFetching: isFetchingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    enabled: user?.role === 'admin' && activeTab === 'users',
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi khi tải danh sách người dùng!', { position: "top-center" }),
  });

  const { data: allocatedUnits = [], isLoading: isLoadingAllocatedUnits, isFetching: isFetchingAllocatedUnits } = useQuery({
    queryKey: ['allocatedUnits'],
    queryFn: getAllocatedUnits,
    enabled: user?.role === 'admin' && (activeTab === 'allocatedUnits' || activeTab === 'users' || activeTab === 'standardizeCodes'), // Thêm standardizeCodes
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
    enabled: user?.role === 'admin' && (activeTab === 'allocationWaves' || activeTab === 'standardizeCodes'), // Thêm standardizeCodes
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi khi tải đợt phân bổ!', { position: "top-center" }),
  });

  const { data: projectTypes = [], isLoading: isLoadingProjectTypes, isFetching: isFetchingProjectTypes } = useQuery({
    queryKey: ['projectTypes'],
    queryFn: getProjectTypes,
    enabled: user?.role === 'admin' && activeTab === 'projectTypes',
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi khi tải loại công trình!', { position: "top-center" }),
  });

  const { data: holidaysDataFromQuery, isLoading: isLoadingHolidays, refetch: refetchHolidays } = useQuery({
    queryKey: ['holidays', selectedHolidayYear],
    queryFn: () => getHolidaysForYearAPI(selectedHolidayYear),
    enabled: user?.role === 'admin' && activeTab === 'holidays',
    staleTime: 0,
    onSuccess: (data) => {
      if (data && data.year === selectedHolidayYear) {
        if (data.holidays && Array.isArray(data.holidays)) {
          const processedHolidays = data.holidays.map(h => {
            if (!h || !h.date) return null;
            const dateObj = new Date(h.date);
            if (isNaN(dateObj.getTime())) return null;
            return { _id: h._id, description: h.description, date: dateObj.toISOString().split('T')[0] };
          }).filter(item => item !== null);
          setHolidaysForSelectedYear(processedHolidays);
        } else {
          setHolidaysForSelectedYear([]);
        }
      } else if (activeTab === 'holidays') {
        setHolidaysForSelectedYear([]);
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || `Lỗi tải ngày nghỉ cho năm ${selectedHolidayYear}!`, { position: "top-center" });
      setHolidaysForSelectedYear([]);
    }
  });

  useEffect(() => {
    if (user?.role === 'admin' && activeTab === 'holidays') {
      // Query will auto-run due to enabled and staleTime
    }
  }, [activeTab, user?.role]);

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
            queryClient.invalidateQueries({queryKey: queryKeyToInvalidate});
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
      queryClient.invalidateQueries({queryKey: ['users']});
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
    () => { setNewAllocatedUnitName(''); setNewAllocatedUnitShortCode(''); setEditAllocatedUnit(null); }
  );
  const saveAllocatedUnit = () => {
    if (!newAllocatedUnitName.trim() || !newAllocatedUnitShortCode.trim()) return toast.error('Vui lòng nhập tên đơn vị và mã viết tắt (3 ký tự)!', { position: "top-center" });
    if (newAllocatedUnitShortCode.trim().length !== 3) return toast.error('Mã viết tắt đơn vị phải có đúng 3 ký tự!', { position: "top-center" });
    allocatedUnitMutation.mutate({ name: newAllocatedUnitName.trim(), shortCode: newAllocatedUnitShortCode.trim().toUpperCase() });
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
    () => { setNewAllocationWaveName(''); setNewAllocationWaveShortCode(''); setEditAllocationWave(null); } // Reset cả shortCode
  );
  const saveAllocationWave = () => {
    if (!newAllocationWaveName.trim() || !newAllocationWaveShortCode.trim()) {
      return toast.error('Vui lòng nhập tên và mã viết tắt (2 ký tự) cho đợt phân bổ!', { position: "top-center" });
    }
    if (newAllocationWaveShortCode.trim().length !== 2) return toast.error('Mã viết tắt đợt phân bổ phải có đúng 2 ký tự!', { position: "top-center" });

    allocationWaveMutation.mutate({ name: newAllocationWaveName.trim(), shortCode: newAllocationWaveShortCode.trim().toUpperCase() });
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

  const prepareSyncMutation = useMutation({
    mutationFn: () => prepareSyncDataAPI(selectedSyncYear, selectedSyncProjectType),
    onSuccess: (data) => {
      if (data && data.length > 0) {
        setPreparedSyncData(data);
        setShowSyncReviewModal(true);
        toast.success(`Đã chuẩn bị ${data.length} công trình để review.`, { position: "top-center" });
      } else {
        toast.info('Không có công trình nào cần đồng bộ cho năm đã chọn.', { position: "top-center" });
      }
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi khi chuẩn bị dữ liệu đồng bộ!', { position: "top-center" }),
  });

  const executeSyncMutation = useMutation({
    mutationFn: executeSyncDataAPI,
    onSuccess: (data) => {
      toast.success(data.message || 'Đồng bộ dữ liệu hoàn tất!', { position: "top-center" });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowSyncReviewModal(false);
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi khi thực thi đồng bộ!', { position: "top-center" }),
  });

  const updateUserProfileMutation = useMutation({
    mutationFn: updateUserProfileAPI,
    onSuccess: (data) => {
      toast.success(data.message || 'Cập nhật thông tin thành công!', { position: "top-center" });
      queryClient.invalidateQueries({queryKey: ['currentUser']});
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

  const addHolidayMutation = useMutation({
    mutationFn: addHolidayAPI,
    onSuccess: (data, variables) => {
      toast.success(`Đã thêm ngày nghỉ ${variables.date} cho năm ${selectedHolidayYear}!`, { position: "top-center" });
      if (data && data.holidays && data.year === selectedHolidayYear) {
        const processedHolidays = data.holidays.map(h => ({
          _id: h._id,
          date: new Date(h.date).toISOString().split('T')[0],
          description: h.description
        })).filter(h => h.date);
        setHolidaysForSelectedYear(processedHolidays);
      }
      queryClient.invalidateQueries({ queryKey: ['holidays', selectedHolidayYear] });
      setNewHoliday({ date: '', description: '' });
    },
    onError: (error) => toast.error(error.response?.data?.message || `Lỗi khi thêm ngày nghỉ!`, { position: "top-center" }),
  });

  const updateHolidayMutation = useMutation({
    mutationFn: updateHolidayAPI,
    onSuccess: (data, variables) => {
      toast.success(`Đã cập nhật ngày nghỉ ${variables.dateString}!`, { position: "top-center" });
      if (data && data.holidays && data.year === selectedHolidayYear) {
        const processedHolidays = data.holidays.map(h => ({ _id: h._id, date: new Date(h.date).toISOString().split('T')[0], description: h.description })).filter(h => h.date);
        setHolidaysForSelectedYear(processedHolidays);
      }
      queryClient.invalidateQueries({ queryKey: ['holidays', selectedHolidayYear] });
      setEditingHoliday(null);
      setEditingHolidayDescription('');
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi khi cập nhật ngày nghỉ!', { position: "top-center" }),
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: deleteHolidayDateAPI,
    onSuccess: (data, variables) => {
      toast.success(data.message || 'Đã xóa ngày nghỉ!', { position: "top-center" });
      if (data && data.holidays && data.holidays.year === selectedHolidayYear) {
        const processedHolidays = data.holidays.holidays.map(h => ({ _id: h._id, date: new Date(h.date).toISOString().split('T')[0], description: h.description })).filter(h => h.date);
        setHolidaysForSelectedYear(processedHolidays);
      }
      queryClient.invalidateQueries({ queryKey: ['holidays', parseInt(variables.year, 10)] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Lỗi khi xóa ngày nghỉ!', { position: "top-center" }),
  });

  const handleAddHoliday = () => {
    if (!newHoliday.date || !newHoliday.description) {
      toast.error('Vui lòng nhập ngày và mô tả cho ngày nghỉ.', { position: "top-center" });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newHoliday.date)) {
        toast.error('Ngày nghỉ không đúng định dạng YYYY-MM-DD.', { position: "top-center" });
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

    const yearToSend = parseInt(selectedHolidayYear, 10);
    addHolidayMutation.mutate({
        year: yearToSend,
        date: newHoliday.date,
        description: newHoliday.description.trim()
    });
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
    updateHolidayMutation.mutate({
      year: selectedHolidayYear,
      dateString: editingHoliday.date,
      description: editingHolidayDescription.trim()
    });
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
    addHolidayMutation.isLoading || updateHolidayMutation.isLoading || deleteHolidayMutation.isLoading;

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

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPageUsers - 1) * itemsPerPage;
    return users.slice(startIndex, startIndex + itemsPerPage);
  }, [users, currentPageUsers, itemsPerPage]);

  const paginatedAllocatedUnits = useMemo(() => {
    const startIndex = (currentPageAllocatedUnits - 1) * itemsPerPage;
    return allocatedUnits.slice(startIndex, startIndex + itemsPerPage);
  }, [allocatedUnits, currentPageAllocatedUnits, itemsPerPage]);

  const paginatedConstructionUnits = useMemo(() => {
    const startIndex = (currentPageConstructionUnits - 1) * itemsPerPage;
    return constructionUnits.slice(startIndex, startIndex + itemsPerPage);
  }, [constructionUnits, currentPageConstructionUnits, itemsPerPage]);

  const paginatedAllocationWaves = useMemo(() => {
    const startIndex = (currentPageAllocationWaves - 1) * itemsPerPage;
    return allocationWaves.slice(startIndex, startIndex + itemsPerPage);
  }, [allocationWaves, currentPageAllocationWaves, itemsPerPage]);

  const paginatedProjectTypes = useMemo(() => {
    const startIndex = (currentPageProjectTypes - 1) * itemsPerPage;
    return projectTypes.slice(startIndex, startIndex + itemsPerPage);
  }, [projectTypes, currentPageProjectTypes, itemsPerPage]);

  useEffect(() => {
    localStorage.setItem('settingsActiveTab', activeTab);
  }, [activeTab]);

  const isOverallLoading = isLoadingTabData ||
                           anyAdminMutationLoading ||
                           anyProfileMutationLoading ||
                           prepareSyncMutation.isLoading ||
                           executeSyncMutation.isLoading;

  // Callback để refresh preparedData sau khi xóa một project từ modal
  // (hoặc từ bất kỳ hành động nào trong modal làm thay đổi dữ liệu nguồn)
  const handleProjectDeletedFromSyncModal = () => {
      // Không đóng modal nữa, chỉ fetch lại dữ liệu
      // setShowSyncReviewModal(false); 
    // Gọi lại prepareSyncMutation để làm mới danh sách
    prepareSyncMutation.mutate(); // Không cần truyền tham số nếu prepareSyncMutation không yêu cầu
    toast.info("Danh sách đồng bộ đã được cập nhật.", { position: "top-center" });
  };
  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Thiết lập</h1>

      {(isOverallLoading) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
          <div className="text-white text-xl p-4 bg-gray-800 rounded-lg">
            {prepareSyncMutation.isLoading ? 'Đang chuẩn bị dữ liệu...' :
             executeSyncMutation.isLoading ? 'Đang thực thi đồng bộ...' :
             isLoadingTabData ? 'Đang tải dữ liệu cài đặt...' : 'Đang xử lý...'}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 border-b mb-6">
        <button onClick={() => setActiveTab('profile')} className={`py-2 px-4 flex items-center gap-2 text-sm font-medium transition-colors duration-150 ${activeTab === 'profile' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-blue-600'}`} disabled={isOverallLoading}><FaUserCog /> Thông tin cá nhân</button>
        {user?.role === 'admin' && (
          <>
            <button onClick={() => setActiveTab('users')} className={`py-2 px-4 flex items-center gap-2 text-sm font-medium transition-colors duration-150 ${activeTab === 'users' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-blue-600'}`} disabled={isOverallLoading}><FaUsers /> Quản lý người dùng</button>
            <button onClick={() => setActiveTab('allocatedUnits')} className={`py-2 px-4 flex items-center gap-2 text-sm font-medium transition-colors duration-150 ${activeTab === 'allocatedUnits' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-blue-600'}`} disabled={isOverallLoading}><FaBuilding /> Quản lý đơn vị</button>
            <button onClick={() => setActiveTab('constructionUnits')} className={`py-2 px-4 flex items-center gap-2 text-sm font-medium transition-colors duration-150 ${activeTab === 'constructionUnits' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-blue-600'}`} disabled={isOverallLoading}><FaHardHat /> Quản lý ĐVTC</button>
            <button onClick={() => setActiveTab('allocationWaves')} className={`py-2 px-4 flex items-center gap-2 text-sm font-medium transition-colors duration-150 ${activeTab === 'allocationWaves' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-blue-600'}`} disabled={isOverallLoading}><FaList /> Quản lý đợt PB</button>
            <button onClick={() => setActiveTab('projectTypes')} className={`py-2 px-4 flex items-center gap-2 text-sm font-medium transition-colors duration-150 ${activeTab === 'projectTypes' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-blue-600'}`} disabled={isOverallLoading}><FaProjectDiagram /> Quản lý loại CT</button>
            <button onClick={() => setActiveTab('syncProjects')} className={`py-2 px-4 flex items-center gap-2 text-sm font-medium transition-colors duration-150 ${activeTab === 'syncProjects' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-blue-600'}`} disabled={isOverallLoading}><FaSync /> Đồng bộ dữ liệu</button>
            <button onClick={() => setActiveTab('holidays')} className={`py-2 px-4 flex items-center gap-2 text-sm font-medium transition-colors duration-150 ${activeTab === 'holidays' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-blue-600'}`} disabled={isOverallLoading}><FaCalendarAlt /> Quản lý Ngày nghỉ</button>
            <button onClick={() => setActiveTab('standardizeCodes')} className={`py-2 px-4 flex items-center gap-2 text-sm font-medium transition-colors duration-150 ${activeTab === 'standardizeCodes' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-blue-600'}`} disabled={isOverallLoading}><FaListAlt /> Chuẩn hóa Mã CT</button>
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
            {isMobile ? (
              <div className="space-y-3 mb-4">
                {paginatedUsers.map(u => (
                  <div key={u._id} className="bg-gray-50 p-4 rounded-lg shadow border border-gray-200">
                    <div className="flex justify-between items-start">
                      <h3 className="text-md font-semibold text-blue-600 mb-2 flex-grow">{u.fullName || u.username}</h3>
                      <button
                        onClick={() => setExpandedUserId(expandedUserId === u._id ? null : u._id)}
                        className="text-xs text-blue-600 hover:text-blue-800 p-1"
                      >
                        {expandedUserId === u._id ? 'Thu gọn' : 'Xem thêm'}
                      </button>
                    </div>
                    <p className="text-sm text-gray-700 mb-1"><span className="font-medium">Username:</span> {u.username}</p>
                    <p className="text-sm text-gray-700 mb-1"><span className="font-medium">Đơn vị:</span> {u.unit || 'N/A'}</p>
                    {(expandedUserId === u._id) && (
                      <>
                        <p className="text-sm text-gray-700 mb-1"><span className="font-medium">Email:</span> {u.email || 'N/A'}</p>
                        <p className="text-sm text-gray-700 mb-1"><span className="font-medium">SĐT:</span> {u.phoneNumber || 'N/A'}</p>
                        <p className="text-sm text-gray-700 mb-1"><span className="font-medium">Địa chỉ:</span> {u.address || 'N/A'}</p>
                        <p className="text-sm text-gray-700 mb-1"><span className="font-medium">Vai trò:</span>
                          {u.role === 'admin' && 'Admin'}
                          {/* ... (các vai trò khác) ... */}
                          {u.role === 'worker' && 'Công nhân'}
                        </p>
                        <p className="text-xs text-gray-600 mb-2"><span className="font-medium">Quyền:</span> {Object.entries(u.permissions || {}).filter(([, value]) => value).map(([key]) => ({add: 'Thêm', edit: 'Sửa', delete: 'Xóa', approve: 'Duyệt', viewRejected: 'Xem TC', assignProfileTimeline: 'PCTL HS', assignConstructionTimeline: 'PCTL TC', viewOtherBranchProjects: 'XemCNKhác'}[key] || key.replace('assign', 'PC').replace('Timeline','TL').replace('Profile','HS').replace('Construction','TC'))).join(', ')}</p>
                      </>
                    )}
                    <div className="mt-3 pt-3 border-t border-gray-200 flex gap-3">
                      <button onClick={() => editUserHandler(u)} className="btn-sm btn-primary flex items-center gap-1" disabled={userMutation.isLoading || deleteUserMutation.isLoading}><FaEdit size={14} /> Sửa</button>
                      <button onClick={() => deleteUserHandler(u._id)} className="btn-sm btn-danger flex items-center gap-1" disabled={userMutation.isLoading || deleteUserMutation.isLoading || u.role === 'admin'}><FaTrash size={14} /> Xóa</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-auto border-collapse">
                  <thead>
                    <tr className="bg-blue-50"><th className="p-4 text-left text-gray-700 font-bold border-b">Tên người dùng</th><th className="p-4 text-left text-gray-700 font-bold border-b">Họ và tên</th><th className="p-4 text-left text-gray-700 font-bold border-b">Đơn vị</th><th className="p-4 text-left text-gray-700 font-bold border-b">Vai trò</th><th className="p-4 text-left text-gray-700 font-bold border-b">Quyền</th><th className="p-4 text-left text-gray-700 font-bold border-b">Hành động</th></tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map(u => (
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
            )}
            {users.length > itemsPerPage && (
              <Pagination
                currentPage={currentPageUsers}
                totalPages={Math.ceil(users.length / itemsPerPage)}
                onPageChange={setCurrentPageUsers}
                isSubmitting={userMutation.isLoading || deleteUserMutation.isLoading}
              />
            )}
          </div>
        </div>
      )}

      {activeTab === 'allocatedUnits' && user?.role === 'admin' && (
        <div className="bg-white p-8 rounded-2xl shadow-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Quản lý đơn vị</h2>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <label className="block text-gray-700 mb-2">Tên đơn vị</label>
              <input type="text" placeholder="Nhập tên đơn vị" value={newAllocatedUnitName} onChange={(e) => setNewAllocatedUnitName(e.target.value)} className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={allocatedUnitMutation.isLoading || deleteAllocatedUnitMutation.isLoading} maxLength={50} />
            </div>
            <div className="flex-1 md:max-w-xs">
              <label className="block text-gray-700 mb-2">Mã viết tắt (3 ký tự)</label>
              <input
                type="text"
                placeholder="VD: TLO"
                value={newAllocatedUnitShortCode}
                onChange={(e) => setNewAllocatedUnitShortCode(e.target.value.toUpperCase())}
                className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={allocatedUnitMutation.isLoading || deleteAllocatedUnitMutation.isLoading}
                maxLength={3} />
            </div>
            <div className="flex items-end gap-4">
              <button onClick={saveAllocatedUnit} className={`bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-md ${allocatedUnitMutation.isLoading || deleteAllocatedUnitMutation.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={allocatedUnitMutation.isLoading || deleteAllocatedUnitMutation.isLoading}><FaBuilding /> {editAllocatedUnit ? 'Cập nhật' : 'Thêm'}</button>
              {editAllocatedUnit && (<button onClick={() => { setNewAllocatedUnitName(''); setNewAllocatedUnitShortCode(''); setEditAllocatedUnit(null); }} className={`bg-gray-600 text-white p-3 rounded-lg hover:bg-gray-700 ${allocatedUnitMutation.isLoading || deleteAllocatedUnitMutation.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={allocatedUnitMutation.isLoading || deleteAllocatedUnitMutation.isLoading}>Hủy</button>)}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-auto border-collapse">
              <thead> <tr className="bg-blue-50"><th className="p-4 text-left text-gray-700 font-bold border-b">Tên đơn vị</th><th className="p-4 text-left text-gray-700 font-bold border-b" style={{width: '150px'}}>Mã viết tắt</th><th className="p-4 text-left text-gray-700 font-bold border-b" style={{width: '120px'}}>Hành động</th></tr> </thead>
              <tbody>
                {paginatedAllocatedUnits.map(unit => (
                  <tr key={unit._id} className="border-t hover:bg-blue-50">
                    <td className="p-4 text-gray-700">{unit.name}</td>
                    <td className="p-4 text-gray-700">{unit.shortCode || 'N/A'}</td>
                    <td className="p-4 flex gap-2">
                      <button onClick={() => { setNewAllocatedUnitName(unit.name); setNewAllocatedUnitShortCode(unit.shortCode || ''); setEditAllocatedUnit(unit);}} className="text-blue-600 hover:text-blue-800 disabled:opacity-50" disabled={allocatedUnitMutation.isLoading || deleteAllocatedUnitMutation.isLoading}><FaEdit size={16} /></button>
                      <button onClick={() => deleteAllocatedUnitHandler(unit._id)} className="text-red-600 hover:text-red-800 disabled:opacity-50" disabled={allocatedUnitMutation.isLoading || deleteAllocatedUnitMutation.isLoading}><FaTrash size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {allocatedUnits.length > itemsPerPage && (
            <Pagination
              currentPage={currentPageAllocatedUnits}
              totalPages={Math.ceil(allocatedUnits.length / itemsPerPage)}
              onPageChange={setCurrentPageAllocatedUnits}
              isSubmitting={allocatedUnitMutation.isLoading || deleteAllocatedUnitMutation.isLoading}
            />
          )}
        </div>
      )}

      {activeTab === 'constructionUnits' && user?.role === 'admin' && (
        <div className="bg-white p-8 rounded-2xl shadow-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Quản lý đơn vị thi công</h2>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <label className="block text-gray-700 mb-2">Tên đơn vị thi công</label>
              <input type="text" placeholder="Nhập tên đơn vị thi công" value={newConstructionUnitName} onChange={(e) => setNewConstructionUnitName(e.target.value)} className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={constructionUnitMutation.isLoading} maxLength={50} />
            </div>
            <div className="flex items-end gap-4">
              <button onClick={saveConstructionUnit} className={`bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-md ${constructionUnitMutation.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={constructionUnitMutation.isLoading}><FaHardHat /> {editConstructionUnit ? 'Cập nhật' : 'Thêm'}</button>
              {editConstructionUnit && (<button onClick={() => { setNewConstructionUnitName(''); setEditConstructionUnit(null);}} className={`bg-gray-600 text-white p-3 rounded-lg hover:bg-gray-700 ${constructionUnitMutation.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={constructionUnitMutation.isLoading}>Hủy</button>)}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-auto border-collapse">
              <thead> <tr className="bg-blue-50"><th className="p-4 text-left text-gray-700 font-bold border-b">Tên đơn vị</th><th className="p-4 text-left text-gray-700 font-bold border-b">Hành động</th></tr> </thead>
              <tbody>
                {paginatedConstructionUnits.map(unit => (
                  <tr key={unit._id} className="border-t hover:bg-blue-50"><td className="p-4 text-gray-700">{unit.name}</td><td className="p-4 flex gap-2"><button onClick={() => { setNewConstructionUnitName(unit.name); setEditConstructionUnit(unit);}} className="text-blue-600 hover:text-blue-800 disabled:opacity-50" disabled={constructionUnitMutation.isLoading || deleteConstructionUnitMutation.isLoading}><FaEdit size={16} /></button><button onClick={() => deleteConstructionUnitHandler(unit._id)} className="text-red-600 hover:text-red-800 disabled:opacity-50" disabled={constructionUnitMutation.isLoading || deleteConstructionUnitMutation.isLoading}><FaTrash size={16} /></button></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {constructionUnits.length > itemsPerPage && (
            <Pagination
              currentPage={currentPageConstructionUnits}
              totalPages={Math.ceil(constructionUnits.length / itemsPerPage)}
              onPageChange={setCurrentPageConstructionUnits}
              isSubmitting={constructionUnitMutation.isLoading || deleteConstructionUnitMutation.isLoading}
            />
          )}
        </div>
      )}

      {activeTab === 'allocationWaves' && user?.role === 'admin' && (
        <div className="bg-white p-8 rounded-2xl shadow-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Quản lý đợt phân bổ</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 items-end">
            <div className="flex-1">
              <label className="block text-gray-700 mb-2">Tên đợt phân bổ</label>
              <input type="text" placeholder="Nhập tên đợt phân bổ" value={newAllocationWaveName} onChange={(e) => setNewAllocationWaveName(e.target.value)} className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={allocationWaveMutation.isLoading} maxLength={50} />
            </div>
            <div className="flex-1">
              <label className="block text-gray-700 mb-2">Mã viết tắt (2 ký tự)</label>
              <input
                type="text"
                placeholder="VD: D1"
                value={newAllocationWaveShortCode}
                onChange={(e) => setNewAllocationWaveShortCode(e.target.value.toUpperCase())}
                className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={allocationWaveMutation.isLoading}
                maxLength={2}
              />
            </div>
            <div className="flex items-end gap-4 md:col-start-3">
              <button onClick={saveAllocationWave} className={`bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-md ${allocationWaveMutation.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={allocationWaveMutation.isLoading}><FaPlus /> {editAllocationWave ? 'Cập nhật' : 'Thêm'}</button>
              {editAllocationWave && (<button onClick={() => { setNewAllocationWaveName(''); setNewAllocationWaveShortCode(''); setEditAllocationWave(null);}} className={`bg-gray-600 text-white p-3 rounded-lg hover:bg-gray-700 ${allocationWaveMutation.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={allocationWaveMutation.isLoading}>Hủy</button>)}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-auto border-collapse">
              <thead> <tr className="bg-blue-50">
                <th className="p-4 text-left text-gray-700 font-bold border-b">Tên đợt phân bổ</th>
                <th className="p-4 text-left text-gray-700 font-bold border-b" style={{width: '150px'}}>Mã viết tắt</th>
                <th className="p-4 text-left text-gray-700 font-bold border-b" style={{width: '120px'}}>Hành động</th></tr> </thead>
              <tbody>
                {paginatedAllocationWaves.map(wave => (
                  <tr key={wave._id} className="border-t hover:bg-blue-50">
                    <td className="p-4 text-gray-700">{wave.name}</td>
                    <td className="p-4 text-gray-700">{wave.shortCode || 'N/A'}</td>
                    <td className="p-4 flex gap-2">
                      <button onClick={() => { setNewAllocationWaveName(wave.name); setNewAllocationWaveShortCode(wave.shortCode || ''); setEditAllocationWave(wave);}} className="text-blue-600 hover:text-blue-800 disabled:opacity-50" disabled={allocationWaveMutation.isLoading || deleteAllocationWaveMutation.isLoading}><FaEdit size={16} /></button>
                      <button onClick={() => deleteAllocationWaveHandler(wave._id)} className="text-red-600 hover:text-red-800 disabled:opacity-50" disabled={allocationWaveMutation.isLoading || deleteAllocationWaveMutation.isLoading}><FaTrash size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {allocationWaves.length > itemsPerPage && (
            <Pagination
              currentPage={currentPageAllocationWaves}
              totalPages={Math.ceil(allocationWaves.length / itemsPerPage)}
              onPageChange={setCurrentPageAllocationWaves}
              isSubmitting={allocationWaveMutation.isLoading || deleteAllocationWaveMutation.isLoading}
            />
          )}
        </div>
      )}

      {activeTab === 'projectTypes' && user?.role === 'admin' && (
        <div className="bg-white p-8 rounded-2xl shadow-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Quản lý loại công trình</h2>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <label className="block text-gray-700 mb-2">Tên loại công trình</label>
              <input type="text" placeholder="Nhập tên loại công trình" value={newProjectTypeName} onChange={(e) => setNewProjectTypeName(e.target.value)} className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={projectTypeMutation.isLoading} maxLength={50} />
            </div>
            <div className="flex items-end gap-4">
              <button onClick={saveProjectType} className={`bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-md ${projectTypeMutation.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={projectTypeMutation.isLoading}><FaPlus /> {editProjectType ? 'Cập nhật' : 'Thêm'}</button>
              {editProjectType && (<button onClick={() => { setNewProjectTypeName(''); setEditProjectType(null);}} className={`bg-gray-600 text-white p-3 rounded-lg hover:bg-gray-700 ${projectTypeMutation.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={projectTypeMutation.isLoading}>Hủy</button>)}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-auto border-collapse">
              <thead> <tr className="bg-blue-50"><th className="p-4 text-left text-gray-700 font-bold border-b">Tên loại công trình</th><th className="p-4 text-left text-gray-700 font-bold border-b">Hành động</th></tr> </thead>
              <tbody>
                {paginatedProjectTypes.map(type => (
                  <tr key={type._id} className="border-t hover:bg-blue-50"><td className="p-4 text-gray-700">{type.name}</td><td className="p-4 flex gap-2"><button onClick={() => { setNewProjectTypeName(type.name); setEditProjectType(type);}} className="text-blue-600 hover:text-blue-800 disabled:opacity-50" disabled={projectTypeMutation.isLoading || deleteProjectTypeMutation.isLoading}><FaEdit size={16} /></button><button onClick={() => deleteProjectTypeHandler(type._id)} className="text-red-600 hover:text-red-800 disabled:opacity-50" disabled={projectTypeMutation.isLoading || deleteProjectTypeMutation.isLoading}><FaTrash size={16} /></button></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {projectTypes.length > itemsPerPage && (
            <Pagination
              currentPage={currentPageProjectTypes}
              totalPages={Math.ceil(projectTypes.length / itemsPerPage)}
              onPageChange={setCurrentPageProjectTypes}
              isSubmitting={projectTypeMutation.isLoading || deleteProjectTypeMutation.isLoading}
            />
          )}
        </div>
      )}

      {activeTab === 'syncProjects' && user?.role === 'admin' && (
        <div className="bg-white p-8 rounded-2xl shadow-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Đồng bộ dữ liệu công trình</h2>
          <p className="text-gray-600 mb-4">
            Chức năng này sẽ giúp kiểm tra và đồng bộ các công trình có form dữ liệu cũ sang form dữ liệu mới nhất.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label htmlFor="syncYear" className="block text-gray-700 mb-2">Chọn năm tài chính:</label>
              <select
                id="syncYear"
                value={selectedSyncYear}
                onChange={(e) => setSelectedSyncYear(e.target.value)}
                className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={prepareSyncMutation.isLoading || executeSyncMutation.isLoading}
              >
                <option value="all">Tất cả các năm</option>
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
                  <option key={year} value={String(year)}>{year}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="syncProjectType" className="block text-gray-700 mb-2">Chọn loại công trình:</label>
              <select
                id="syncProjectType"
                value={selectedSyncProjectType}
                onChange={(e) => setSelectedSyncProjectType(e.target.value)}
                className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={prepareSyncMutation.isLoading || executeSyncMutation.isLoading}
              >
                <option value="all">Tất cả loại công trình</option>
                <option value="category">Công trình Danh mục</option>
                <option value="minor_repair">Công trình Sửa chữa nhỏ</option>
              </select>
            </div>
          </div>
          <button
            onClick={() => prepareSyncMutation.mutate()}
            className={`text-white p-3 rounded-lg flex items-center justify-center gap-2 shadow-md transition-all duration-150
                        ${prepareSyncMutation.isLoading || executeSyncMutation.isLoading
                          ? 'bg-blue-400 opacity-75 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 hover:scale-105 active:scale-100'
                        }`}
            disabled={prepareSyncMutation.isLoading || executeSyncMutation.isLoading}>
            <FaSync className={`${prepareSyncMutation.isLoading ? 'animate-spin' : ''}`} /> {prepareSyncMutation.isLoading ? 'Đang chuẩn bị...' : 'Chuẩn bị & Review Dữ liệu'}
          </button>
        </div>
      )}
      {activeTab === 'holidays' && user?.role === 'admin' && (
        <div className="bg-white p-8 rounded-2xl shadow-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Quản lý Ngày nghỉ Lễ</h2>
          <div className="mb-6">
            <label className="block text-gray-700 mb-2">Chọn năm tài chính:</label>
            <select
              value={selectedHolidayYear}
              onChange={(e) => setSelectedHolidayYear(parseInt(e.target.value, 10))}
              className="w-full md:w-1/3 border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={addHolidayMutation.isLoading || updateHolidayMutation.isLoading || deleteHolidayMutation.isLoading || isLoadingHolidays}
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
                disabled={addHolidayMutation.isLoading}
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
                disabled={addHolidayMutation.isLoading}
              />
            </div>
          </div>
          <button
            onClick={handleAddHoliday}
            className={`bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 flex items-center gap-2 mb-6 ${addHolidayMutation.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={addHolidayMutation.isLoading}
          >
            <FaPlus /> Thêm ngày nghỉ
          </button>

          <h3 className="text-xl font-semibold text-gray-700 mb-4">Danh sách ngày nghỉ năm {selectedHolidayYear}</h3>
          {isLoadingHolidays && <p>Đang tải ngày nghỉ...</p>}
          {!isLoadingHolidays && holidaysForSelectedYear.length === 0 && (
            <p className="text-gray-500">
              Chưa có ngày nghỉ nào được thiết lập cho năm {selectedHolidayYear}.
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
                        disabled={updateHolidayMutation.isLoading}
                      />
                      <button onClick={handleSaveEditedHoliday} className="btn btn-success btn-sm" disabled={updateHolidayMutation.isLoading}>Lưu</button>
                      <button onClick={() => setEditingHoliday(null)} className="btn btn-secondary btn-sm" disabled={updateHolidayMutation.isLoading}>Hủy</button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium text-gray-800">{new Date(holiday.date + "T00:00:00Z").toLocaleDateString('vi-VN')}</span>
                        <span className="text-gray-600 ml-2">- {holiday.description}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleStartEditHoliday(holiday)} className="text-blue-500 hover:text-blue-700 disabled:opacity-50" disabled={deleteHolidayMutation.isLoading || updateHolidayMutation.isLoading || addHolidayMutation.isLoading}>
                          <FaEdit size={16} />
                        </button>
                        <button onClick={() => handleDeleteHoliday(holiday.date)} className="text-red-500 hover:text-red-700 disabled:opacity-50" disabled={deleteHolidayMutation.isLoading || updateHolidayMutation.isLoading || addHolidayMutation.isLoading}>
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

      {activeTab === 'standardizeCodes' && user?.role === 'admin' && (
        <ProjectCodeStandardization
          user={user}
        />
      )}

      {showSyncReviewModal && (
        <SyncReviewModal
          isOpen={showSyncReviewModal}
          onRequestClose={() => setShowSyncReviewModal(false)}
          preparedData={preparedSyncData}
          onConfirmSync={(projectsToSync) => {
            const payload = { projectsToSyncFromFrontend: projectsToSync };
            if (selectedSyncYear && String(selectedSyncYear).toLowerCase() !== 'all') payload.targetFinancialYear = parseInt(selectedSyncYear, 10);
            if (selectedSyncProjectType && String(selectedSyncProjectType).toLowerCase() !== 'all') payload.targetProjectType = selectedSyncProjectType;
            executeSyncMutation.mutate(payload);
          }}
          onProjectDeleted={handleProjectDeletedFromSyncModal} // Truyền callback
          currentUser={user} // Truyền currentUser
          isExecutingSync={executeSyncMutation.isLoading}
          dataSources={{ // Truyền dataSources vào modal
            allocatedUnits: allocatedUnits,
            usersList: users, // Giả sử users là danh sách user đầy đủ
            projectTypesList: projectTypes,
            constructionUnitsList: constructionUnits,
            allocationWavesList: allocationWaves,
            currentUser: user, // Truyền user hiện tại
          }}
        />
      )}
    </div>
  );
}

export default Settings;
