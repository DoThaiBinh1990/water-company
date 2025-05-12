// frontend/src/components/ProjectFilter.js
import { FaSearch, FaUndo } from 'react-icons/fa'; // Thêm FaUndo

function ProjectFilter({
  filterStatus,
  setFilterStatus,
  filterAllocatedUnit,
  setFilterAllocatedUnit,
  filterConstructionUnit,
  setFilterConstructionUnit,
  filterName,
  setFilterName,
  filterMinInitialValue,
  setFilterMinInitialValue,
  filterMaxInitialValue,
  setFilterMaxInitialValue,
  filterProgress,
  setFilterProgress,
  allocatedUnits,
  constructionUnitsList,
  isCategory,
  sortOrder,
  handleSortChange,
  isLoading,
  isSubmitting,
  onResetFilters, // Thêm prop để gọi hàm reset từ cha
}) {
  const handleGenericFilterChange = (setter, value) => {
    setter(value);
  };

  return (
    <div className="card mb-6 p-4 md:p-6 animate-fadeIn">
      <div className="flex flex-wrap justify-between items-center mb-5 gap-4">
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Bộ lọc tìm kiếm</h3>
        {/* Chuyển Sort xuống dưới hoặc giữ nguyên tùy ý */}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-5 gap-y-4">
        {/* Input Tên công trình */}
        <div>
          <label htmlFor="filter_name" className="form-label">Tên công trình</label>
          <div className="input-with-icon">
            <input
              id="filter_name"
              type="text"
              placeholder="Nhập tên..."
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              className="form-input pl-9 text-sm py-2" // Đảm bảo padding tồn tại
              disabled={isLoading || isSubmitting}
            />
            <FaSearch className="input-icon" />
          </div>
        </div>

        {/* Select Trạng thái */}
        <div>
          <label htmlFor="filter_status" className="form-label">Trạng thái</label>
          <select
            id="filter_status"
            value={filterStatus}
            onChange={(e) => handleGenericFilterChange(setFilterStatus, e.target.value)}
            className="form-select text-sm py-2"
            disabled={isLoading || isSubmitting}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="Chờ duyệt">Chờ duyệt</option>
            <option value="Đã duyệt">Đã duyệt</option>
            <option value="Từ chối">Từ chối</option>
          </select>
        </div>

        {/* Select Đơn vị phân bổ */}
        <div>
          <label htmlFor="filter_allocatedUnit" className="form-label">Chi nhánh</label>
          <select
            id="filter_allocatedUnit"
            value={filterAllocatedUnit}
            onChange={(e) => handleGenericFilterChange(setFilterAllocatedUnit, e.target.value)}
            className="form-select text-sm py-2"
            disabled={isLoading || isSubmitting}
          >
            <option value="">Tất cả chi nhánh</option>
            {allocatedUnits.map((unit) => (
              <option key={unit._id} value={unit.name}>
                {unit.name}
              </option>
            ))}
          </select>
        </div>

        {/* Các Filter chỉ dành cho Category */}
        {isCategory && (
          <>
            <div>
              <label htmlFor="filter_constructionUnit" className="form-label">Đơn vị thi công</label>
              <select
                id="filter_constructionUnit"
                value={filterConstructionUnit}
                onChange={(e) => handleGenericFilterChange(setFilterConstructionUnit, e.target.value)}
                className="form-select text-sm py-2"
                disabled={isLoading || isSubmitting}
              >
                <option value="">Tất cả ĐVTC</option>
                {constructionUnitsList.map((unit) => (
                  <option key={unit._id} value={unit.name}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filter_minInitialValue" className="form-label">Giá trị PB (Từ)</label>
              <input
                id="filter_minInitialValue"
                type="number"
                placeholder="0"
                value={filterMinInitialValue}
                onChange={(e) => handleGenericFilterChange(setFilterMinInitialValue, e.target.value)}
                className="form-input text-sm py-2"
                disabled={isLoading || isSubmitting}
                min="0"
                step="any"
              />
            </div>
            <div>
              <label htmlFor="filter_maxInitialValue" className="form-label">Giá trị PB (Đến)</label>
              <input
                id="filter_maxInitialValue"
                type="number"
                placeholder="Không giới hạn"
                value={filterMaxInitialValue}
                onChange={(e) => handleGenericFilterChange(setFilterMaxInitialValue, e.target.value)}
                className="form-input text-sm py-2"
                disabled={isLoading || isSubmitting}
                min="0"
                step="any"
              />
            </div>
            <div>
              <label htmlFor="filter_progress" className="form-label">Tiến độ thi công</label>
              <input
                id="filter_progress"
                type="text"
                placeholder="Nhập tiến độ..."
                value={filterProgress}
                onChange={(e) => handleGenericFilterChange(setFilterProgress, e.target.value)}
                className="form-input text-sm py-2"
                disabled={isLoading || isSubmitting}
              />
            </div>
          </>
        )}

         {/* Sort Order Dropdown - Có thể di chuyển lên đầu hoặc để cuối cùng */}
         <div className="sm:col-start-1 xl:col-start-auto"> {/* Đảm bảo nó xuống hàng trên màn hình nhỏ nếu cần */}
           <label htmlFor="filter_sort" className="form-label">Sắp xếp theo</label>
           <select
             id="filter_sort"
             value={sortOrder}
             onChange={handleSortChange}
             className="form-select text-sm py-2"
             disabled={isLoading || isSubmitting}
           >
             <option value="serial_asc">STT (Tăng dần)</option>
             <option value="created_desc">Ngày tạo (Mới nhất)</option>
             {/* Thêm các tùy chọn sắp xếp khác nếu muốn */}
           </select>
         </div>

         {/* Nút Reset Filters */}
         <div className="flex items-end justify-start sm:col-start-1 md:col-start-auto"> {/* Điều chỉnh vị trí nút reset */}
           <button
             type="button"
             onClick={onResetFilters} // Gọi hàm từ props
             className="form-btn form-btn-secondary text-sm py-2 px-4 h-[42px]" // Set chiều cao cố định = input/select
             disabled={isLoading || isSubmitting}
             title="Đặt lại bộ lọc" // Thêm tooltip
           >
             <FaUndo className="mr-1" /> Đặt lại
           </button>
         </div>

      </div>
    </div>
  );
}

export default ProjectFilter;