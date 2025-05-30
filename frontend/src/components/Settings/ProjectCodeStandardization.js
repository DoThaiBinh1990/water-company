import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import Modal from 'react-modal';
import { FaFilter, FaSyncAlt, FaTimes, FaListAlt, FaSpinner } from 'react-icons/fa';
import {
  getAllocatedUnits,
  getAllocationWaves,
  prepareProjectCodeStandardizationAPI,
  executeProjectCodeStandardizationAPI,
} from '../../apiService';
import { formatDateToLocale } from '../../utils/dateUtils';
import { useMediaQuery } from '../../hooks/useMediaQuery'; // Import hook

Modal.setAppElement('#root');

const ProjectCodeStandardization = ({ user }) => {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();

  const [filters, setFilters] = useState({
    financialYear: '', // Mặc định là "Tất cả các năm"
    projectType: 'category', // 'category' or 'minor_repair'
    allocatedUnitId: '', // '' sẽ đại diện cho "Tất cả đơn vị"
    allocationWaveId: '', // '' sẽ đại diện cho "Tất cả đợt"
  });

  const [projectsToReview, setProjectsToReview] = useState([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const { data: allocatedUnits = [], isLoading: isLoadingAllocatedUnits } = useQuery({
    queryKey: ['allocatedUnits'],
    queryFn: getAllocatedUnits,
    enabled: !!user,
  });

  const { data: allocationWaves = [], isLoading: isLoadingAllocationWaves } = useQuery({
    queryKey: ['allocationWaves'],
    queryFn: getAllocationWaves,
    enabled: !!user && filters.projectType === 'category',
  });

  const financialYearOptions = useMemo(() => {
    const years = Array.from({ length: 10 }, (_, i) => String(currentYear - 5 + i));
    // Thêm tùy chọn "Tất cả" lên đầu
    return [{ value: '', label: 'Tất cả các năm' }, ...years.map(year => ({ value: year, label: year }))];
  }, [currentYear]);

  const prepareMutation = useMutation({
    mutationFn: prepareProjectCodeStandardizationAPI,
    onSuccess: (data) => {
      if (data && data.length > 0) {
        setProjectsToReview(data);
        setShowReviewModal(true);
      } else {
        toast.info('Không có công trình nào cần chuẩn hóa cho bộ lọc này.', { position: "top-center" });
        setProjectsToReview([]);
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Lỗi khi lấy danh sách công trình cần chuẩn hóa!', { position: "top-center" });
    },
  });

  const executeMutation = useMutation({
    mutationFn: executeProjectCodeStandardizationAPI,
    onSuccess: (data) => {
      toast.success(data.message || `Đã chuẩn hóa ${data.updatedCount || 0} mã công trình.`, { position: "top-center" });
      setShowReviewModal(false);
      setProjectsToReview([]);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Lỗi khi thực hiện chuẩn hóa mã!', { position: "top-center" });
    },
  });

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => {
      const newFilters = { ...prev, [name]: value };
      if (name === 'projectType' && value === 'minor_repair') {
        newFilters.allocationWaveId = ''; // Reset đợt phân bổ nếu là SCN
      }
      return newFilters;
    });
  };

  const handlePrepareStandardization = () => {
    if (!filters.projectType) {
      toast.warn('Vui lòng chọn Loại công trình.', { position: "top-center" });
      return;
    }
    // Bỏ kiểm tra bắt buộc allocatedUnitId ở đây.
    // Nếu allocatedUnitId rỗng, backend sẽ hiểu là "tất cả đơn vị".
    const params = { ...filters };
    if (!filters.allocatedUnitId) {
      params.allocatedUnitId = ''; // Gửi chuỗi rỗng nếu không chọn đơn vị
    }
    // Đảm bảo allocationWaveId là rỗng nếu không phải category hoặc không được chọn
    if (filters.projectType === 'minor_repair' || !filters.allocationWaveId) {
      params.allocationWaveId = '';
    }
    prepareMutation.mutate(params);
  };
  const handleExecuteStandardization = () => {
    // Bỏ kiểm tra bắt buộc allocatedUnitId ở đây.
    // Backend sẽ xử lý trường hợp allocatedUnitId rỗng.
    const payload = { ...filters };
    if (!filters.allocatedUnitId) {
      payload.allocatedUnitId = ''; // Gửi chuỗi rỗng nếu không chọn đơn vị
    }
    if (filters.projectType === 'minor_repair' || !filters.allocationWaveId) {
      payload.allocationWaveId = '';
    }
    executeMutation.mutate(payload);
  };

  const isLoading = isLoadingAllocatedUnits || isLoadingAllocationWaves || prepareMutation.isLoading || executeMutation.isLoading;
  const isPrepareDisabled = isLoading || !filters.projectType; // Chỉ cần chọn Loại công trình

  return (
    <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <FaListAlt className="text-blue-600" /> Chuẩn hóa Mã Công trình
      </h2>
      <p className="text-sm text-gray-600 mb-2">
        Tính năng này giúp lọc và sắp xếp lại mã của các công trình theo một logic chuẩn (Loại CT, Năm, Đơn vị PB, Số thứ tự theo ngày tạo).
        Chỉ những công trình có mã chưa đúng chuẩn hoặc nằm ngoài chuỗi mã chuẩn liên tiếp sẽ được đề xuất để chuẩn hóa.
      </p>
      <p className="text-sm text-orange-600 mb-6">Lưu ý: Nếu không chọn "Đơn vị phân bổ", hệ thống sẽ chuẩn hóa cho tất cả các đơn vị. Quá trình này có thể mất nhiều thời gian.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 items-end">
        <div>
          <label htmlFor="financialYearStd" className="form-label">Năm tài chính</label>
          <select id="financialYearStd" name="financialYear" value={filters.financialYear} onChange={handleFilterChange} className="form-input" disabled={isLoading}>
            {financialYearOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="projectTypeStd" className="form-label">Loại công trình</label>
          <select id="projectTypeStd" name="projectType" value={filters.projectType} onChange={handleFilterChange} className="form-input" disabled={isLoading}>
            <option value="category">Công trình Danh mục</option>
            <option value="minor_repair">Công trình Sửa chữa nhỏ</option>
          </select>
        </div>
        <div>
          <label htmlFor="allocatedUnitIdStd" className="form-label">Đơn vị phân bổ</label>
          <select id="allocatedUnitIdStd" name="allocatedUnitId" value={filters.allocatedUnitId} onChange={handleFilterChange} className="form-input" disabled={isLoading || allocatedUnits.length === 0}>
            <option value="">Tất cả đơn vị</option>
            {allocatedUnits.map(unit => <option key={unit._id} value={unit._id}>{unit.name}</option>)}
          </select>
        </div>
        {filters.projectType === 'category' && (
          <div>
            <label htmlFor="allocationWaveIdStd" className="form-label">Đợt phân bổ (DM)</label>
            <select id="allocationWaveIdStd" name="allocationWaveId" value={filters.allocationWaveId} onChange={handleFilterChange} className="form-input" disabled={isLoading || allocationWaves.length === 0}>
              <option value="">Tất cả đợt</option>
              {allocationWaves.map(wave => <option key={wave._id} value={wave._id}>{wave.name}</option>)}
            </select>
          </div>
        )}
        <div className={filters.projectType === 'category' ? "lg:col-start-4" : "lg:col-start-3 lg:col-span-2"}>
            <button
                onClick={handlePrepareStandardization}
                className={`btn btn-primary w-full flex items-center justify-center gap-2 ${isPrepareDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isPrepareDisabled}
            >
                {prepareMutation.isLoading ? <FaSpinner className="animate-spin" /> : <FaFilter />}
                Xem công trình cần chuẩn hóa
            </button>
        </div>
      </div>

      <Modal
        isOpen={showReviewModal}
        onRequestClose={() => { if (!executeMutation.isLoading) setShowReviewModal(false); }}
        style={{
          overlay: {
            zIndex: 10001,
            backgroundColor: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
          content: {
            position: 'relative',
            inset: 'auto', // Quan trọng
            maxHeight: '85vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            padding: '0',
            border: '1px solid #ccc',
            borderRadius: '8px',
            background: '#fff',
            boxSizing: 'border-box',
            ...(isMobile ? {
              width: 'auto',
              marginLeft: '1rem',
              marginRight: '1rem',
              maxWidth: 'calc(100vw - 2rem)',
            } : {
              width: '90%', // Giữ nguyên cho desktop
              maxWidth: '800px', // Giữ nguyên cho desktop
              margin: 'auto', // Căn giữa cho desktop
            })
          }
        }}
        contentLabel="Xem trước Công trình Cần Chuẩn hóa"
      >
        <div className="p-5 bg-gray-800 text-white border-b border-gray-700 flex justify-between items-center rounded-t-lg">
          <h3 className="text-lg font-semibold">Công trình cần chuẩn hóa mã</h3>
          <button onClick={() => { if (!executeMutation.isLoading) setShowReviewModal(false); }} className="p-2 rounded-full hover:bg-gray-700 transition-colors" disabled={executeMutation.isLoading}><FaTimes size={16} /></button>
        </div>

        <div className="p-5 overflow-y-auto flex-grow">
          {projectsToReview.length === 0 ? (
            <p className="text-center text-gray-600 py-8">Không có công trình nào cần chuẩn hóa theo bộ lọc này, hoặc tất cả đã đúng chuẩn.</p>
          ) : (
            isMobile ? (
              <div className="space-y-3">
                {projectsToReview.map((p, index) => (
                  <div key={p._id} className="bg-white p-3 rounded-lg shadow border border-gray-200">
                    <p className="text-xs text-gray-500">STT: {index + 1}</p>
                    <h4 className="text-sm font-semibold text-blue-600 mb-1">{p.name}</h4>
                    <p className="text-xs text-gray-700"><span className="font-medium">Đơn vị:</span> {p.allocatedUnitName || 'N/A'}</p>
                    <p className="text-xs text-gray-700">
                      <span className="font-medium">Mã hiện tại:</span> {p.currentProjectCode || 'Chưa có'}
                    </p>
                    <p className="text-xs text-gray-700">
                      <span className="font-medium">Ngày tạo:</span> {formatDateToLocale(p.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase tracking-wider border-r">STT</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider border-r">Tên công trình</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider border-r">Đơn vị PB</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider border-r">Mã hiện tại</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">Ngày tạo</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {projectsToReview.map((p, index) => (
                      <tr key={p._id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-center text-xs text-gray-700 border-r">{index + 1}</td>
                        <td className="px-3 py-2 text-xs text-gray-800 border-r">{p.name}</td>
                        <td className="px-3 py-2 text-xs text-gray-700 border-r">{p.allocatedUnitName || 'N/A'}</td>
                        <td className="px-3 py-2 text-xs text-gray-700 border-r">{p.currentProjectCode || 'Chưa có'}</td>
                        <td className="px-3 py-2 text-center text-xs text-gray-700">{formatDateToLocale(p.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

        <div className="p-4 bg-gray-100 border-t border-gray-200 flex justify-end gap-3 rounded-b-lg">
          <button
            type="button"
            onClick={() => { if (!executeMutation.isLoading) setShowReviewModal(false); }}
            disabled={executeMutation.isLoading}
            className="btn btn-secondary"
          >
            <FaTimes className="mr-2" /> Hủy
          </button>
          {projectsToReview.length > 0 && (
            <button
              type="button"
              onClick={handleExecuteStandardization}
              disabled={executeMutation.isLoading || !filters.projectType} // Chỉ cần projectType
              className={`btn btn-danger flex items-center justify-center gap-2 ${!filters.projectType ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {executeMutation.isLoading ? <FaSpinner className="animate-spin" /> : <FaSyncAlt />}
              Xác nhận Chuẩn hóa ({projectsToReview.length})
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ProjectCodeStandardization;
