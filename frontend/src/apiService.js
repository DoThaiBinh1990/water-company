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
    // console.log('[Interceptor] Token from localStorage on request:', token); 
    if (token && token !== 'undefined' && token !== 'null') { // Chỉ đính kèm token nếu nó là một chuỗi hợp lệ
      config.headers['Authorization'] = `Bearer ${token}`;    
      // console.log('[Interceptor] Authorization header SET for request to:', config.url);
    } else {    
      // console.log('[Interceptor] No valid token found or token is "undefined"/"null" string. Header NOT SET for:', config.url);
      delete config.headers['Authorization']; 
    }    
    return config;
  },
  (error) => {
    // console.error('[Interceptor] Request error:', error);
    return Promise.reject(error);
  }
);

// Auth
export const loginUser = async (credentials) => {
  const { data } = await apiClient.post('/api/login', credentials);
  return data; // { token, user }
};

export const getMe = async () => {
  // console.log('[getMe] Attempting to fetch /api/auth/me. Token in localStorage at this moment:', localStorage.getItem('token'));
  try {
    const { data } = await apiClient.get('/api/auth/me');
    // console.log('[getMe] /api/auth/me raw response data:', JSON.stringify(data, null, 2));
    if (data && data.user && (data.user.username || data.user._id || data.user.id)) { // Kiểm tra data.user và có trường định danh
        // console.log('[getMe] Returning data.user:', JSON.stringify(data.user, null, 2));
        return data.user;
    } else {
        // console.error('[getMe] /api/auth/me response does NOT contain a valid data.user. Raw data:', JSON.stringify(data, null, 2));
        return null; // Trả về null để App.js onSuccess xử lý logout
    }
  } catch (error) {
    // console.error('[getMe] Error fetching /api/auth/me:', error.response?.data || error.message);
    return null; // Trả về null khi có lỗi API để onSuccess của useQuery có thể nhận và xử lý
  }
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

export const getRejectedProjects = async (params) => {
  // params sẽ là một object chứa các trường như: { type, page, limit, search, allocatedUnit, requestedBy, rejectedBy }
  const { data } = await apiClient.get('/api/rejected-projects', { params });
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

// Excel Import
export const importProjects = async ({ projects, projectType }) => {
  const { data } = await apiClient.post(`/api/projects/import?type=${projectType}`, { projects });
  return data;
};

// API to mark project as completed
export const markProjectAsCompletedAPI = async ({ projectId, type }) => {
  const { data } = await apiClient.patch(`/api/projects/${projectId}/complete?type=${type}`);
  return data;
};

export const moveProjectToNextFinancialYearAPI = async ({ projectId, type }) => {
  const { data } = await apiClient.patch(`/api/projects/${projectId}/move-next-year?type=${type}`);
  return data;
};

// API to fetch profile timeline data for category projects
export const fetchProfileTimelineCategoryAPI = async (params) => {
  // params: { financialYear, estimatorId }
  const { data } = await apiClient.get('/api/projects/timeline/profile-category', { params });
  return data;
};

// API to fetch construction timeline data
export const fetchConstructionTimelineAPI = async (params) => {
  // params: { type ('category' or 'minor_repair'), financialYear, constructionUnitName }
  const { data } = await apiClient.get('/api/projects/timeline/construction', { params });
  return data;
};

// API to update a single profile timeline task
export const updateProfileTimelineTaskAPI = async ({ projectId, updateData }) => {
  // updateData: { startDate, endDate, durationDays, progress, statusNotes }
  const { data } = await apiClient.patch(`/api/projects/timeline/profile-category/${projectId}`, updateData);
  return data;
};

// API to update a single construction timeline task
export const updateConstructionTimelineTaskAPI = async ({ projectId, type, updateData }) => {
  const { data } = await apiClient.patch(`/api/projects/timeline/construction/${projectId}?type=${type}`, updateData);
  return data;
};
// API to batch update profile timeline
export const batchUpdateProfileTimelineAPI = async (payload) => {
  // payload: { financialYear, estimatorId, assignments: [{ projectId, startDate, durationDays, ... }] }
  const { data } = await apiClient.patch('/api/projects/timeline/profile-category/batch-update', payload);
  return data;
};

export const batchUpdateConstructionTimelineAPI = async (payload) => {
  // payload: { type, financialYear, constructionUnitName, assignments: [...] }
  const { data } = await apiClient.patch('/api/projects/timeline/construction/batch-update', payload);
  return data;
};

// API to fetch projects for timeline assignment
export const fetchProjectsForTimelineAssignmentAPI = async (params) => {
  const { data } = await apiClient.get('/api/projects/timeline/for-assignment', { params });
  return data; // Should be an array of projects
};

// Holiday Management APIs
export const getHolidaysForYearAPI = async (year) => {
  const { data } = await apiClient.get(`/api/holidays/${year}`);
  return data; // Expects { year, holidays: [{ date, description }] } or { year, holidays: [] }
};

export const createOrUpdateHolidaysForYearAPI = async ({ year, holidays }) => {
  // holidays should be an array of { date: 'YYYY-MM-DD', description: '...' }
  const { data } = await apiClient.post('/api/holidays', { year, holidays });
  return data;
};

export const deleteHolidayDateAPI = async ({ year, dateString }) => {
  const { data } = await apiClient.delete(`/api/holidays/${year}/date/${dateString}`);
  return data;
};
