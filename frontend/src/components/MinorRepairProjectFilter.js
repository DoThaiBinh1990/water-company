import { FaEye, FaEyeSlash } from 'react-icons/fa';

function MinorRepairProjectFilter({
  filterStatus,
  setFilterStatus,
  filterAllocatedUnit,
  setFilterAllocatedUnit,
  filterName,
  setFilterName,
  allocatedUnits,
  sortOrder,
  handleSortChange,
  isLoading,
  onResetFilters,
  showFilter,
  setShowFilter,
}) {
  return (
    <div className="filter-container card p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-subheading">Bộ lọc</h2>
        <button
          onClick={() => setShowFilter(!showFilter)}
          className="btn btn-secondary hover:bg-gray-700 transition-all duration-300 transform hover:scale-105 shadow-lg"
          title={showFilter ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}
        >
          {showFilter ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
          <span className="hidden sm:inline ml-2">{showFilter ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}</span>
        </button>
      </div>

      {showFilter && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="form-label">Tên công trình</label>
            <input
              type="text"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              className="form-input"
              placeholder="Nhập tên công trình..."
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="form-label">Trạng thái</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="form-select"
              disabled={isLoading}
            >
              <option value="">Tất cả</option>
              <option value="pending">Chờ duyệt</option>
              <option value="approved">Đã duyệt</option>
              <option value="rejected">Từ chối</option>
              <option value="assigned">Đã phân công</option>
            </select>
          </div>

          <div>
            <label className="form-label">Đơn vị phân bổ</label>
            <select
              value={filterAllocatedUnit}
              onChange={(e) => setFilterAllocatedUnit(e.target.value)}
              className="form-select"
              disabled={isLoading}
            >
              <option value="">Tất cả</option>
              {allocatedUnits.map((unit, index) => (
                <option key={index} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Sắp xếp theo</label>
            <select
              value={sortOrder}
              onChange={handleSortChange}
              className="form-select"
              disabled={isLoading}
            >
              <option value="serial_asc">Số seri (Tăng dần)</option>
              <option value="created_desc">Ngày tạo (Mới nhất)</option>
            </select>
          </div>
        </div>
      )}

      {showFilter && (
        <div className="flex justify-end mt-6">
          <button
            onClick={onResetFilters}
            className="btn btn-reset hover:bg-gray-300 transition-all duration-300 transform hover:scale-105 shadow-lg"
            disabled={isLoading}
          >
            Đặt lại bộ lọc
          </button>
        </div>
      )}
    </div>
  );
}

export default MinorRepairProjectFilter;