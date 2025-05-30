// d:\CODE\water-company\frontend\src\components\TimelineManagement\TimelineLogic.js
import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; // Thêm useMutation, useQueryClient
import {
  fetchProfileTimelineCategoryAPI,
  fetchConstructionTimelineAPI,
  batchUpdateProfileTimelineAPI, // API mới
  updateProfileTimelineTaskAPI, // API mới
  updateConstructionTimelineTaskAPI, // API mới
  batchUpdateConstructionTimelineAPI, // API mới
  fetchProjectsForTimelineAssignmentAPI, // API mới
} from '../../apiService';
import { toast } from 'react-toastify';


export const useTimelineData = ({ user, timelineType, objectType, initialYear, filterParams = {} }) => {
  // timelineType: 'profile' or 'construction'
  // objectType: 'category' or 'minor_repair' (chỉ dùng cho construction)
  // filterParams: { estimatorId, constructionUnitName }

  const [financialYear, setFinancialYear] = useState(initialYear || new Date().getFullYear());
  const queryClient = useQueryClient();

  const queryKey = useMemo(() => {
    let key = ['timeline', timelineType, financialYear];
    if (timelineType === 'construction') key.push(objectType);
    if (filterParams.estimatorId) key.push(`estimator-${filterParams.estimatorId}`);
    if (filterParams.constructionUnitName) key.push(`unit-${filterParams.constructionUnitName}`);
    return key;
  }, [timelineType, objectType, financialYear, filterParams]);

  const queryFn = useCallback(async () => {
    const params = {
      financialYear,
      ...filterParams,
    };
    if (timelineType === 'profile' && objectType === 'category') {
      return fetchProfileTimelineCategoryAPI(params);
    } else if (timelineType === 'construction') {
      params.type = objectType; // 'category' or 'minor_repair'
      return fetchConstructionTimelineAPI(params);
    }
    return Promise.resolve([]); // Default empty array if no match
  }, [timelineType, objectType, financialYear, filterParams]);

  const { data: timelineTasks = [], isLoading, isError, error, refetch } = useQuery({
    queryKey,
    queryFn,
    enabled: !!user && !!financialYear,
    keepPreviousData: true,
    onError: (err) => {
      toast.error(err.response?.data?.message || `Lỗi tải dữ liệu timeline ${timelineType}!`, { position: "top-center" });
    }
  });

  // Mutation để cập nhật một task timeline hồ sơ
  const updateProfileTimelineTaskMutation = useMutation({
    mutationFn: updateProfileTimelineTaskAPI,
    onSuccess: (data) => {
      toast.success(data.message || 'Đã cập nhật task timeline hồ sơ!', { position: "top-center" });
      // Invalidate query của timeline chính để fetch lại dữ liệu mới nhất
      queryClient.invalidateQueries(queryKey);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Lỗi khi cập nhật task timeline hồ sơ!', { position: "top-center" });
      // Có thể cần refetch lại query nếu cập nhật thất bại để hiển thị dữ liệu cũ chính xác
      queryClient.invalidateQueries(queryKey);
    }
  });

  // Mutation để cập nhật một task timeline thi công
  const updateConstructionTimelineTaskMutation = useMutation({
    mutationFn: updateConstructionTimelineTaskAPI,
    onSuccess: (data) => {
      toast.success(data.message || 'Đã cập nhật task timeline thi công!', { position: "top-center" });
      queryClient.invalidateQueries(queryKey);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Lỗi khi cập nhật task timeline thi công!', { position: "top-center" });
      queryClient.invalidateQueries(queryKey);
    }
  });

  // Hàm xử lý onDateChange từ Gantt chart
  const handleDateChange = useCallback((changedGanttTask) => {
    // changedGanttTask là object task từ gantt-task-react,
    // đã chứa _originalTask và start, end mới (là Date objects)
    const originalTask = changedGanttTask?._originalTask;
    if (!originalTask || (!originalTask._id && !originalTask.id)) {
      toast.error('Lỗi: Không tìm thấy ID công trình gốc để cập nhật ngày tháng.', { position: "top-center" });
      return;
    }
    const projectId = originalTask._id || originalTask.id;
    const updateData = {
      startDate: changedGanttTask.start.toISOString().split('T')[0], // Chuyển Date object thành string YYYY-MM-DD
      endDate: changedGanttTask.end.toISOString().split('T')[0],   // Chuyển Date object thành string YYYY-MM-DD
      // durationDays sẽ được tính lại ở backend hoặc frontend nếu cần
    };
    
    if (timelineType === 'profile') {
      updateProfileTimelineTaskMutation.mutate({ projectId, updateData });
    } else if (timelineType === 'construction') {
      updateConstructionTimelineTaskMutation.mutate({ projectId, type: objectType, updateData });
    }
  }, [timelineType, objectType, updateProfileTimelineTaskMutation, updateConstructionTimelineTaskMutation]);

  // Hàm xử lý onProgressChange từ Gantt chart
  const handleProgressChange = useCallback((changedGanttTask) => {
    const originalTask = changedGanttTask?._originalTask;
    if (!originalTask || (!originalTask._id && !originalTask.id)) {
      toast.error('Lỗi: Không tìm thấy ID công trình gốc để cập nhật tiến độ.', { position: "top-center" });
      return;
    }
    const projectId = originalTask._id || originalTask.id;
    const updateData = {
      progress: parseInt(changedGanttTask.progress, 10) || 0, // Đảm bảo progress là số
    };
    if (timelineType === 'profile') {
      updateProfileTimelineTaskMutation.mutate({ projectId, updateData });
    } else if (timelineType === 'construction') {
      updateConstructionTimelineTaskMutation.mutate({ projectId, type: objectType, updateData });
    }
  }, [timelineType, objectType, updateProfileTimelineTaskMutation, updateConstructionTimelineTaskMutation]);

  // Hàm xử lý lưu thông tin thực tế từ ActualProgressModal
  const handleSaveActualProgress = useCallback(({ projectId, actualData, callbacks }) => {
    // actualData: { actualStartDate, actualEndDate, progress, statusNotes }
    if (!projectId) {
      toast.error('Lỗi: Không có ID công trình để cập nhật thông tin thực tế.', { position: "top-center" });
      callbacks?.onError?.();
      return;
    }
    const updatePayload = { ...actualData }; // progress và statusNotes đã có, thêm actualStartDate, actualEndDate

    if (timelineType === 'profile') {
      updateProfileTimelineTaskMutation.mutate({ projectId, updateData: updatePayload }, {
        onSuccess: () => callbacks?.onSuccess?.(),
        onError: () => callbacks?.onError?.(),
      });
    } else if (timelineType === 'construction') {
      // type (objectType) đã được bao gồm trong closure của updateConstructionTimelineTaskMutation
      updateConstructionTimelineTaskMutation.mutate({ projectId, type: objectType, updateData: updatePayload }, {
        onSuccess: () => callbacks?.onSuccess?.(),
        onError: () => callbacks?.onError?.(),
      });
    }
  }, [timelineType, objectType, updateProfileTimelineTaskMutation, updateConstructionTimelineTaskMutation]);


  // Lấy danh sách công trình đủ điều kiện để phân công
  // (Chưa có timeline, hoặc assignmentType là 'auto', và chưa hoàn thành)
  const projectsForAssignmentQueryKey = useMemo(() => {
    let key = ['projectsForAssignment', timelineType, financialYear];
    if (timelineType === 'construction') key.push(objectType);
    if (filterParams.estimatorId) key.push(`estimator-${filterParams.estimatorId}`);
    if (filterParams.constructionUnitName) key.push(`unit-${filterParams.constructionUnitName}`);
    return key;
  }, [timelineType, objectType, financialYear, filterParams]);

  const fetchProjectsForAssignment = useCallback(async () => {
    const params = {
      timelineType, // 'profile' or 'construction'
      objectType,   // 'category' or 'minor_repair'
      financialYear,
      // Các filterParams đã được spread vào queryKey, backend sẽ nhận chúng
      // estimatorId hoặc constructionUnitName sẽ nằm trong filterParams
      ...filterParams,
    };

    // Chỉ gọi API nếu có đối tượng phân công cụ thể
    if ((timelineType === 'profile' && !filterParams.estimatorId) || (timelineType === 'construction' && !filterParams.constructionUnitName)) {
      return []; // Không có đối tượng phân công cụ thể, không lấy gì cả
    }

    const projects = await fetchProjectsForTimelineAssignmentAPI(params);
    return projects || []; // Đảm bảo luôn trả về một mảng
  }, [financialYear, timelineType, objectType, filterParams]);

  const { data: projectsToAssign = [], isLoading: isLoadingProjectsToAssign } = useQuery({
    queryKey: projectsForAssignmentQueryKey,
    queryFn: fetchProjectsForAssignment,
    enabled: !!user && !!financialYear && (!!filterParams.estimatorId || !!filterParams.constructionUnitName), // Chỉ fetch khi có đối tượng cụ thể
  });

  // Mutation để lưu phân công
  const saveTimelineAssignmentsMutation = useMutation({
    mutationFn: (payload) => {
      if (timelineType === 'profile') {
        return batchUpdateProfileTimelineAPI(payload);
      } else if (timelineType === 'construction') {
        return batchUpdateConstructionTimelineAPI(payload);
      }
      return Promise.reject(new Error('Loại timeline không hợp lệ'));
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Đã lưu phân công timeline!', { position: "top-center" });
      queryClient.invalidateQueries(queryKey); // Invalidate query của timeline chính
      queryClient.invalidateQueries(projectsForAssignmentQueryKey); // Invalidate query của ds công trình cần phân công
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Lỗi khi lưu phân công timeline!', { position: "top-center" });
    }
  });

  return {
    timelineTasks,
    isLoading,
    isError,
    error,
    financialYear,
    setFinancialYear,
    refetchTimeline: refetch,
    projectsToAssign,
    isLoadingProjectsToAssign,
    saveTimelineAssignments: saveTimelineAssignmentsMutation.mutate,
    isSavingAssignments: saveTimelineAssignmentsMutation.isLoading,
    // Export các hàm và trạng thái mới
    updateProfileTimelineTask: updateProfileTimelineTaskMutation.mutate,
    updateConstructionTimelineTask: updateConstructionTimelineTaskMutation.mutate,
    isUpdatingTimelineTask: updateProfileTimelineTaskMutation.isLoading || updateConstructionTimelineTaskMutation.isLoading,
    handleDateChange,
    handleProgressChange, // Export handler cho onProgressChange
    handleSaveActualProgress, // Export hàm lưu thông tin thực tế
  };
};
