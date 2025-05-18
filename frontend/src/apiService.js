import axios from 'axios';
import { API_URL } from './config';

// Thêm export cho apiClient
export const apiClient = axios.create({
  baseURL: API_URL,
});

// Interceptor để tự động thêm token vào header của mỗi request
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      // Đảm bảo header Authorization luôn được đặt nếu có token
      // Điều này quan trọng khi ứng dụng tải lại và apiClient được khởi tạo lại
      // mà không qua luồng đăng nhập (nơi token được set trực tiếp vào defaults).
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    // console.log('API Request Config (from apiService.js):', config); // Bỏ comment để kiểm tra nếu cần
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Auth
export const loginUser = async (credentials) => {
  const { data } = await apiClient.post('/api/login', credentials);
  return data; // { token, user }
};

export const getMe = async () => {
  // console.log('Attempting to fetch /api/auth/me'); // Bỏ comment để kiểm tra nếu cần
  const { data } = await apiClient.get('/api/auth/me');
  // console.log('/api/auth/me response data:', data); // Bỏ comment để kiểm tra nếu cần
  return data.user; // Giả sử API trả về { user: ... }
};

// Users (trong Settings)
export const getUsers = async () => {
  const { data } = await apiClient.get('/api/users');
  return data;
};

export const createUser = async (userData) => {
  const { data } = await apiClient.post('/api/users', userData);
  return data;
};

export const updateUser = async ({ userId, userData }) => {
  const { data } = await apiClient.patch(`/api/users/${userId}`, userData);
  return data;
};

export const deleteUser = async (userId) => {
  const { data } = await apiClient.delete(`/api/users/${userId}`);
  return data;
};

// User self-update
export const updateUserProfile = async (profileData) => {
  const { data } = await apiClient.patch('/api/users/me/profile', profileData);
  return data; // { message, user }
};

export const changeUserPassword = async (passwordData) => {
  const { data } = await apiClient.patch('/api/users/me/password', passwordData);
  return data; // { message }
};

// Allocated Units (trong Settings)
export const getAllocatedUnits = async () => {
  const { data } = await apiClient.get('/api/allocated-units');
  return data;
};

export const createAllocatedUnit = async (unitData) => {
  const { data } = await apiClient.post('/api/allocated-units', unitData);
  return data;
};

export const updateAllocatedUnit = async ({ unitId, unitData }) => {
  const { data } = await apiClient.patch(`/api/allocated-units/${unitId}`, unitData);
  return data;
};

export const deleteAllocatedUnit = async (unitId) => {
  const { data } = await apiClient.delete(`/api/allocated-units/${unitId}`);
  return data;
};

// Construction Units (trong Settings)
export const getConstructionUnits = async () => {
  const { data } = await apiClient.get('/api/construction-units');
  return data;
};

export const createConstructionUnit = async (unitData) => {
  const { data } = await apiClient.post('/api/construction-units', unitData);
  return data;
};

export const updateConstructionUnit = async ({ unitId, unitData }) => {
  const { data } = await apiClient.patch(`/api/construction-units/${unitId}`, unitData);
  return data;
};

export const deleteConstructionUnit = async (unitId) => {
  const { data } = await apiClient.delete(`/api/construction-units/${unitId}`);
  return data;
};

// Notifications
export const getNotificationsByStatus = async (status) => {
  const { data } = await apiClient.get(`/api/notifications?status=${status}`);
  return data || []; // Đảm bảo luôn trả về một mảng
};

// Allocation Waves (trong Settings)
export const getAllocationWaves = async () => {
  const { data } = await apiClient.get('/api/allocation-waves');
  return data;
};

export const createAllocationWave = async (waveData) => {
  const { data } = await apiClient.post('/api/allocation-waves', waveData);
  return data;
};

export const updateAllocationWave = async ({ waveId, waveData }) => {
  const { data } = await apiClient.patch(`/api/allocation-waves/${waveId}`, waveData);
  return data;
};

export const deleteAllocationWave = async (waveId) => {
  const { data } = await apiClient.delete(`/api/allocation-waves/${waveId}`);
  return data;
};

// Project Types (trong Settings)
export const getProjectTypes = async () => {
  const { data } = await apiClient.get('/api/project-types');
  return data;
};

export const createProjectType = async (typeData) => {
  const { data } = await apiClient.post('/api/project-types', typeData);
  return data;
};

export const updateProjectType = async ({ typeId, typeData }) => {
  const { data } = await apiClient.patch(`/api/project-types/${typeId}`, typeData);
  return data;
};

export const deleteProjectType = async (typeId) => {
  const { data } = await apiClient.delete(`/api/project-types/${typeId}`);
  return data;
};


// Project Status and Actions (from App.js context)
export const getProjectStatus = async ({ projectId, type }) => {
  const { data } = await apiClient.get(`/api/projects/${projectId}/status?type=${type}`);
  return data;
};

export const approveEditProject = async ({ projectId, type }) => {
  // Lưu ý: Backend hiện tại dùng chung route /approve cho cả duyệt mới và duyệt sửa.
  // Nếu có route riêng /approve-edit thì đổi ở đây.
  const { data } = await apiClient.patch(`/api/projects/${projectId}/approve?type=${type}`);
  return data;
};

export const rejectEditProject = async ({ projectId, type, reason }) => { // Thêm reason nếu API cần
  // Tương tự, backend có thể dùng chung route /reject.
  const { data } = await apiClient.patch(`/api/projects/${projectId}/reject?type=${type}`, { reason });
  return data;
};

export const approveDeleteProject = async ({ projectId, type }) => {
  const { data } = await apiClient.patch(`/api/projects/${projectId}/approve?type=${type}`);
  return data;
};

export const rejectDeleteProject = async ({ projectId, type, reason }) => { // Thêm reason nếu API cần
  const { data } = await apiClient.patch(`/api/projects/${projectId}/reject?type=${type}`, { reason });
  return data;
};

// Sync
export const syncProjectsData = async () => {
  const { data } = await apiClient.post('/api/sync-projects');
  return data;
};

// Project Management
export const getProjects = async (params) => {
  const { data } = await apiClient.get('/api/projects', { params });
  return data;
};

export const createProject = async (projectData) => {
  const { data } = await apiClient.post('/api/projects', projectData);
  return data;
};

export const updateProject = async ({ projectId, type, data: projectUpdateData }) => { // đổi tên data thành projectUpdateData
  const response = await apiClient.patch(`/api/projects/${projectId}?type=${type}`, projectUpdateData);
  return response.data;
};

export const deleteProject = async ({ projectId, type }) => {
  const { data } = await apiClient.delete(`/api/projects/${projectId}?type=${type}`);
  return data;
};

export const approveProject = async ({ projectId, type }) => {
  const { data } = await apiClient.patch(`/api/projects/${projectId}/approve?type=${type}`);
  return data;
};

export const rejectProject = async ({ projectId, type, reason }) => {
  const { data } = await apiClient.patch(`/api/projects/${projectId}/reject?type=${type}`, { reason });
  return data;
};

export const allocateProject = async ({ projectId, type, constructionUnit, allocationWave }) => {
  const { data } = await apiClient.patch(`/api/projects/${projectId}/allocate?type=${type}`, { constructionUnit, allocationWave });
  return data;
};

export const assignProject = async ({ projectId, type, supervisor, estimator }) => {
  const { data } = await apiClient.patch(`/api/projects/${projectId}/assign?type=${type}`, { supervisor, estimator });
  return data;
};

export const getRejectedProjects = async ({ type, page = 1, limit = 10 }) => {
  const { data } = await apiClient.get('/api/rejected-projects', { params: { type, page, limit } });
  return data;
};

export const restoreRejectedProject = async ({ rejectedId, projectDetails, projectModel, originalProjectId, actionType }) => {
  const { data } = await apiClient.post(`/api/rejected-projects/${rejectedId}/restore`, { projectDetails, projectModel, originalProjectId, actionType });
  return data;
};

export const permanentlyDeleteRejectedProject = async (rejectedId) => {
  const { data } = await apiClient.delete(`/api/rejected-projects/${rejectedId}`);
  return data;
};
