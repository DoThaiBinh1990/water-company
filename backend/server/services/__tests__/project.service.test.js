// d:\CODE\water-company\backend\server\services\__tests__\project.service.test.js

// Import service cần test
const projectService = require('../project.service');

// Import các Models mà service này tương tác để có thể mock chúng
const { CategoryProject, MinorRepairProject, User, Notification } = require('../../models');

// Mock các Models sử dụng trong service
jest.mock('../../models', () => ({
  // Mock CategoryProject và MinorRepairProject như những hàm constructor
  // Chúng cũng có thể có các phương thức static được mock (như find, countDocuments)
  CategoryProject: jest.fn().mockImplementation(() => ({
    save: jest.fn().mockResolvedValue({}), // Mock save trên instance
    toObject: jest.fn().mockReturnValue({}), // Mock toObject trên instance
  })),
  MinorRepairProject: jest.fn().mockImplementation(() => ({
    save: jest.fn().mockResolvedValue({}), // Mock save trên instance
    toObject: jest.fn().mockReturnValue({}), // Mock toObject trên instance
  })),
  User: {
    findById: jest.fn(),
    findOne: jest.fn(),
  },
  Notification: (() => {
    // Tạo một hàm mock cho constructor
    const mockConstructor = jest.fn().mockImplementation(() => ({
      save: jest.fn().mockResolvedValue({}),
      toObject: jest.fn().mockReturnValue({}),
    }));
    // Gán các phương thức static cho hàm mock constructor này
    mockConstructor.findOne = jest.fn();
    mockConstructor.countDocuments = jest.fn();
    return mockConstructor; // Trả về hàm mock constructor đã có các phương thức static
  })(),
}));

// Gán các phương thức static mock cho CategoryProject và MinorRepairProject sau khi chúng được mock như hàm
CategoryProject.countDocuments = jest.fn();
CategoryProject.find = jest.fn();
CategoryProject.findById = jest.fn();
// Thêm các mock cho các hàm static khác nếu service có sử dụng
CategoryProject.deleteOne = jest.fn();


MinorRepairProject.countDocuments = jest.fn();
MinorRepairProject.find = jest.fn();
MinorRepairProject.findById = jest.fn();
// Thêm các mock cho các hàm static khác nếu service có sử dụng
MinorRepairProject.deleteOne = jest.fn();


// Mock hàm populateProjectFields và updateSerialNumbers từ utils
jest.mock('../../utils', () => ({
  populateProjectFields: jest.fn(doc => Promise.resolve(doc)),
  updateSerialNumbers: jest.fn().mockResolvedValue(true),
}));
// Import sau khi mock để lấy phiên bản đã mock
const { populateProjectFields, updateSerialNumbers } = require('../../utils');

// Nhóm các test case cho hàm getProjectsList
describe('ProjectService - getProjectsList', () => {
  // Hàm helper để tạo đối tượng mock cho query chain
  const createMockQueryChain = (mockData = []) => ({
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(mockData), // limit trả về Promise với mockData
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mỗi khi find được gọi, nó sẽ trả về một bộ mock chain mới
    CategoryProject.find.mockImplementation(() => createMockQueryChain());
    MinorRepairProject.find.mockImplementation(() => createMockQueryChain());
  });

  it('should call CategoryProject.find and countDocuments when type is category', async () => {
    const queryParams = { type: 'category', page: 1, limit: 10 };
    const mockCatProjects = [{ _id: 'cat1', name: 'Cat Project 1' }];
    CategoryProject.countDocuments.mockResolvedValue(5);
    // Cấu hình cho lần gọi find cụ thể này
    CategoryProject.find.mockImplementationOnce(() => createMockQueryChain(mockCatProjects));


    await projectService.getProjectsList(queryParams);

    expect(CategoryProject.find).toHaveBeenCalled();
    expect(CategoryProject.countDocuments).toHaveBeenCalled();
    expect(MinorRepairProject.find).not.toHaveBeenCalled();
    expect(MinorRepairProject.countDocuments).not.toHaveBeenCalled();
  });

  it('should call MinorRepairProject.find and countDocuments when type is minor_repair', async () => {
    const queryParams = { type: 'minor_repair', page: 1, limit: 10 };
    const mockMinorProjects = [{ _id: 'minor1', name: 'Minor Project 1' }];
    MinorRepairProject.countDocuments.mockResolvedValue(3);
    MinorRepairProject.find.mockImplementationOnce(() => createMockQueryChain(mockMinorProjects));

    await projectService.getProjectsList(queryParams);

    expect(MinorRepairProject.find).toHaveBeenCalled();
    expect(MinorRepairProject.countDocuments).toHaveBeenCalled();
    expect(CategoryProject.find).not.toHaveBeenCalled();
    expect(CategoryProject.countDocuments).not.toHaveBeenCalled();
  });

  it('should default to CategoryProject when type is not specified', async () => {
    const queryParams = { page: 1, limit: 10 }; // type không được cung cấp
    const mockCatProjects = [{ _id: 'cat1', name: 'Cat Project 1' }];
    CategoryProject.countDocuments.mockResolvedValue(10);
    CategoryProject.find.mockImplementationOnce(() => createMockQueryChain(mockCatProjects));

    await projectService.getProjectsList(queryParams);

    expect(CategoryProject.find).toHaveBeenCalled();
    expect(CategoryProject.countDocuments).toHaveBeenCalled();
    expect(MinorRepairProject.find).not.toHaveBeenCalled();
    expect(MinorRepairProject.countDocuments).not.toHaveBeenCalled();
  });

  it('should apply status filter correctly', async () => {
    const queryParams = { type: 'category', status: 'Đã duyệt', page: 1, limit: 10 };
    CategoryProject.countDocuments.mockResolvedValue(0);
    // find().limit() sẽ trả về [] mặc định từ mockChain trong beforeEach

    await projectService.getProjectsList(queryParams);

    const expectedQuery = { status: 'Đã duyệt' };
    expect(CategoryProject.find).toHaveBeenCalledWith(expectedQuery);
    expect(CategoryProject.countDocuments).toHaveBeenCalledWith(expectedQuery);
  });

  it('should apply pending filter correctly when pending is true', async () => {
    const queryParams = { type: 'category', pending: 'true', page: 1, limit: 10 };
    CategoryProject.countDocuments.mockResolvedValue(0);

    await projectService.getProjectsList(queryParams);

    const expectedQuery = {
      $or: [
        { status: 'Chờ duyệt' },
        { pendingEdit: { $ne: null, $exists: true } },
        { pendingDelete: true }
      ]
    };
    expect(CategoryProject.find).toHaveBeenCalledWith(expectedQuery);
    expect(CategoryProject.countDocuments).toHaveBeenCalledWith(expectedQuery);
  });

  it('should apply search filter for name correctly', async () => {
    const queryParams = { type: 'category', search: 'Test Project', page: 1, limit: 10 };
    CategoryProject.countDocuments.mockResolvedValue(0);

    await projectService.getProjectsList(queryParams);

    const expectedQuery = { name: { $regex: 'Test Project', $options: 'i' }, status: 'Đã duyệt' };
    expect(CategoryProject.find).toHaveBeenCalledWith(expectedQuery);
    expect(CategoryProject.countDocuments).toHaveBeenCalledWith(expectedQuery);
  });

  it('should apply allocatedUnit filter correctly', async () => {
    const queryParams = { type: 'category', allocatedUnit: 'Unit A', page: 1, limit: 10 };
    CategoryProject.countDocuments.mockResolvedValue(0);

    await projectService.getProjectsList(queryParams);

    const expectedQuery = { allocatedUnit: 'Unit A', status: 'Đã duyệt' };
    expect(CategoryProject.find).toHaveBeenCalledWith(expectedQuery);
    expect(CategoryProject.countDocuments).toHaveBeenCalledWith(expectedQuery);
  });

  it('should apply constructionUnit filter for category type', async () => {
    const queryParams = { type: 'category', constructionUnit: 'Const Unit B', page: 1, limit: 10 };
    CategoryProject.countDocuments.mockResolvedValue(0);

    await projectService.getProjectsList(queryParams);

    const expectedQuery = { constructionUnit: 'Const Unit B', status: 'Đã duyệt' };
    expect(CategoryProject.find).toHaveBeenCalledWith(expectedQuery);
    expect(CategoryProject.countDocuments).toHaveBeenCalledWith(expectedQuery);
  });

  it('should NOT apply constructionUnit filter for minor_repair type', async () => {
    const queryParams = { type: 'minor_repair', constructionUnit: 'Const Unit B', page: 1, limit: 10 };
    MinorRepairProject.countDocuments.mockResolvedValue(0);

    await projectService.getProjectsList(queryParams);

    const expectedQuery = { status: 'Đã duyệt' }; // Không có constructionUnit
    expect(MinorRepairProject.find).toHaveBeenCalledWith(expectedQuery);
    expect(MinorRepairProject.countDocuments).toHaveBeenCalledWith(expectedQuery);
  });

  it('should apply allocationWave filter for category type', async () => {
    const queryParams = { type: 'category', allocationWave: 'Wave 1', page: 1, limit: 10 };
    CategoryProject.countDocuments.mockResolvedValue(0);

    await projectService.getProjectsList(queryParams);

    const expectedQuery = { allocationWave: 'Wave 1', status: 'Đã duyệt' };
    expect(CategoryProject.find).toHaveBeenCalledWith(expectedQuery);
    expect(CategoryProject.countDocuments).toHaveBeenCalledWith(expectedQuery);
  });

  it('should NOT apply allocationWave filter for minor_repair type', async () => {
    const queryParams = { type: 'minor_repair', allocationWave: 'Wave 1', page: 1, limit: 10 };
    MinorRepairProject.countDocuments.mockResolvedValue(0);

    await projectService.getProjectsList(queryParams);

    const expectedQuery = { status: 'Đã duyệt' };
    expect(MinorRepairProject.find).toHaveBeenCalledWith(expectedQuery);
    expect(MinorRepairProject.countDocuments).toHaveBeenCalledWith(expectedQuery);
  });

  it('should apply supervisor filter correctly', async () => {
    const queryParams = { type: 'category', supervisor: 'supervisorId123', page: 1, limit: 10 };
    CategoryProject.countDocuments.mockResolvedValue(0);

    await projectService.getProjectsList(queryParams);

    const expectedQuery = { supervisor: 'supervisorId123', status: 'Đã duyệt' };
    expect(CategoryProject.find).toHaveBeenCalledWith(expectedQuery);
    expect(CategoryProject.countDocuments).toHaveBeenCalledWith(expectedQuery);
  });

  it('should apply estimator filter for category type', async () => {
    const queryParams = { type: 'category', estimator: 'estimatorId456', page: 1, limit: 10 };
    CategoryProject.countDocuments.mockResolvedValue(0);

    await projectService.getProjectsList(queryParams);

    const expectedQuery = { estimator: 'estimatorId456', status: 'Đã duyệt' };
    expect(CategoryProject.find).toHaveBeenCalledWith(expectedQuery);
    expect(CategoryProject.countDocuments).toHaveBeenCalledWith(expectedQuery);
  });

  it('should NOT apply estimator filter for minor_repair type', async () => {
    const queryParams = { type: 'minor_repair', estimator: 'estimatorId456', page: 1, limit: 10 };
    MinorRepairProject.countDocuments.mockResolvedValue(0);

    await projectService.getProjectsList(queryParams);

    const expectedQuery = { status: 'Đã duyệt' };
    expect(MinorRepairProject.find).toHaveBeenCalledWith(expectedQuery);
    expect(MinorRepairProject.countDocuments).toHaveBeenCalledWith(expectedQuery);
  });

  it('should apply minInitialValue filter for category type', async () => {
    const queryParams = { type: 'category', minInitialValue: '1000', page: 1, limit: 10 };
    CategoryProject.countDocuments.mockResolvedValue(0);

    await projectService.getProjectsList(queryParams);

    const expectedQuery = { initialValue: { $gte: 1000 }, status: 'Đã duyệt' };
    expect(CategoryProject.find).toHaveBeenCalledWith(expectedQuery);
    expect(CategoryProject.countDocuments).toHaveBeenCalledWith(expectedQuery);
  });

  it('should apply maxInitialValue filter for category type', async () => {
    const queryParams = { type: 'category', maxInitialValue: '5000', page: 1, limit: 10 };
    CategoryProject.countDocuments.mockResolvedValue(0);

    await projectService.getProjectsList(queryParams);

    const expectedQuery = { initialValue: { $lte: 5000 }, status: 'Đã duyệt' };
    expect(CategoryProject.find).toHaveBeenCalledWith(expectedQuery);
    expect(CategoryProject.countDocuments).toHaveBeenCalledWith(expectedQuery);
  });

  it('should apply min and max InitialValue filters for category type', async () => {
    const queryParams = { type: 'category', minInitialValue: '1000', maxInitialValue: '5000', page: 1, limit: 10 };
    CategoryProject.countDocuments.mockResolvedValue(0);

    await projectService.getProjectsList(queryParams);

    const expectedQuery = { initialValue: { $gte: 1000, $lte: 5000 }, status: 'Đã duyệt' };
    expect(CategoryProject.find).toHaveBeenCalledWith(expectedQuery);
    expect(CategoryProject.countDocuments).toHaveBeenCalledWith(expectedQuery);
  });

  it('should NOT apply InitialValue filters for minor_repair type', async () => {
    const queryParams = { type: 'minor_repair', minInitialValue: '1000', maxInitialValue: '5000', page: 1, limit: 10 };
    MinorRepairProject.countDocuments.mockResolvedValue(0);

    await projectService.getProjectsList(queryParams);

    const expectedQuery = { status: 'Đã duyệt' };
    expect(MinorRepairProject.find).toHaveBeenCalledWith(expectedQuery);
    expect(MinorRepairProject.countDocuments).toHaveBeenCalledWith(expectedQuery);
  });

  it('should apply progress filter for category type', async () => {
    const queryParams = { type: 'category', progress: 'Đang thực hiện', page: 1, limit: 10 };
    CategoryProject.countDocuments.mockResolvedValue(0);

    await projectService.getProjectsList(queryParams);

    const expectedQuery = { progress: 'Đang thực hiện', status: 'Đã duyệt' };
    expect(CategoryProject.find).toHaveBeenCalledWith(expectedQuery);
    expect(CategoryProject.countDocuments).toHaveBeenCalledWith(expectedQuery);
  });

  it('should NOT apply progress filter for minor_repair type', async () => {
    const queryParams = { type: 'minor_repair', progress: 'Đang thực hiện', page: 1, limit: 10 };
    MinorRepairProject.countDocuments.mockResolvedValue(0);

    await projectService.getProjectsList(queryParams);

    const expectedQuery = { status: 'Đã duyệt' };
    expect(MinorRepairProject.find).toHaveBeenCalledWith(expectedQuery);
    expect(MinorRepairProject.countDocuments).toHaveBeenCalledWith(expectedQuery);
  });

  it('should apply pagination and sorting correctly', async () => {
    const queryParams = { type: 'category', page: 2, limit: 5 };
    const mockProjects = [{ _id: 'p6' }, { _id: 'p7' }, { _id: 'p8' }, { _id: 'p9' }, { _id: 'p10' }];

    CategoryProject.countDocuments.mockResolvedValue(12);
    const mockQueryChainInstance = createMockQueryChain(mockProjects);
    CategoryProject.find.mockImplementationOnce(() => mockQueryChainInstance);

    const result = await projectService.getProjectsList(queryParams);

    expect(CategoryProject.find).toHaveBeenCalledWith({ status: 'Đã duyệt' });
    expect(mockQueryChainInstance.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(mockQueryChainInstance.skip).toHaveBeenCalledWith(5);
    expect(mockQueryChainInstance.limit).toHaveBeenCalledWith(5);
    expect(CategoryProject.countDocuments).toHaveBeenCalledWith({ status: 'Đã duyệt' });

    expect(result.projects).toEqual(mockProjects);
    expect(result.total).toBe(12);
    expect(result.page).toBe(2);
    expect(result.pages).toBe(3);
  });

  it('should use default pagination when page and limit are not provided', async () => {
    const queryParams = { type: 'category' };
    CategoryProject.countDocuments.mockResolvedValue(25);
    const mockQueryChainInstance = createMockQueryChain([]);
    CategoryProject.find.mockImplementationOnce(() => mockQueryChainInstance);

    await projectService.getProjectsList(queryParams);

    expect(mockQueryChainInstance.skip).toHaveBeenCalledWith(0);
    expect(mockQueryChainInstance.limit).toHaveBeenCalledWith(10);
    expect(CategoryProject.countDocuments).toHaveBeenCalledWith({ status: 'Đã duyệt' });
  });
});

// Nhóm các test case cho hàm createNewProject
describe('ProjectService - createNewProject', () => {
    // Mock giá trị trả về cho User.findById khi tìm người duyệt
    const mockApprover = { _id: 'approverId', permissions: { approve: true }, fullName: 'Approver User' };
    const mockUser = { id: 'userId', username: 'testuser', permissions: { add: true } };
    const mockIo = { emit: jest.fn() }; // Mock Socket.IO instance

    // Mock instance của CategoryProject và MinorRepairProject
    const mockCategoryProjectInstance = {
        save: jest.fn(),
        toObject: jest.fn(), // Sẽ được mock trong beforeEach để trả về chính nó
        _id: 'newCatProjectId',
        name: 'New Cat Project',
        type: 'category', // Giữ lại type ở đây để mock toObject
        createdBy: mockUser.id,
        approvedBy: mockApprover._id,
    };
     const mockMinorRepairProjectInstance = {
        save: jest.fn(),
        toObject: jest.fn(), // Sẽ được mock trong beforeEach
        _id: 'newMinorProjectId',
        name: 'New Minor Project',
        type: 'minor_repair', // Giữ lại type ở đây
        createdBy: mockUser.id,
        approvedBy: mockApprover._id,
    };


    beforeEach(() => {
        jest.clearAllMocks();

        User.findById.mockResolvedValue(mockApprover);

        // Thiết lập mock cho constructor của CategoryProject và MinorRepairProject
        CategoryProject.mockImplementationOnce(() => mockCategoryProjectInstance);
        MinorRepairProject.mockImplementationOnce(() => mockMinorRepairProjectInstance);

        // Thiết lập mock cho hàm save và toObject của instance project
        mockCategoryProjectInstance.save.mockResolvedValue(mockCategoryProjectInstance);
        mockCategoryProjectInstance.toObject.mockReturnValue(mockCategoryProjectInstance); // toObject trả về chính instance mock

        mockMinorRepairProjectInstance.save.mockResolvedValue(mockMinorRepairProjectInstance);
        mockMinorRepairProjectInstance.toObject.mockReturnValue(mockMinorRepairProjectInstance);


        // Tạo một instance mock cho Notification
        const mockNotificationSaveInstance = {
            _id: 'notifId',
            save: jest.fn(),
            toObject: jest.fn().mockReturnValue({ _id: 'notifId' }),
        };
        mockNotificationSaveInstance.save.mockResolvedValue(mockNotificationSaveInstance);

        Notification.mockImplementation(() => {
            return mockNotificationSaveInstance;
        });

        populateProjectFields.mockImplementation(doc => Promise.resolve({
            ...doc, // Giữ lại các thuộc tính gốc
            createdBy: { _id: doc.createdBy, fullName: 'Test Creator' },
            approvedBy: { _id: doc.approvedBy, fullName: 'Test Approver' },
        }));
    });

    it('should create a new category project and notification', async () => {
        const projectData = {
            name: 'Test Cat Project',
            allocatedUnit: 'Unit A',
            location: 'Location X',
            approvedBy: mockApprover._id,
            scale: 'Small',
        };

        const result = await projectService.createNewProject(projectData, mockUser, 'category', mockIo);

        expect(User.findById).toHaveBeenCalledWith(mockApprover._id);
        expect(CategoryProject).toHaveBeenCalledTimes(1);
        expect(CategoryProject).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Test Cat Project',
            allocatedUnit: 'Unit A',
            location: 'Location X',
            approvedBy: mockApprover._id,
            scale: 'Small',
            enteredBy: mockUser.username,
            createdBy: mockUser.id,
        }));
        expect(mockCategoryProjectInstance.save).toHaveBeenCalledTimes(1);
        expect(populateProjectFields).toHaveBeenCalledTimes(1);
        expect(populateProjectFields).toHaveBeenCalledWith(mockCategoryProjectInstance);
        expect(Notification).toHaveBeenCalledTimes(1);
        expect(Notification).toHaveBeenCalledWith(expect.objectContaining({
             message: expect.stringContaining(`Yêu cầu thêm công trình mới "${mockCategoryProjectInstance.name}"`),
             type: 'new',
             projectId: mockCategoryProjectInstance._id,
             projectModel: 'CategoryProject',
             status: 'pending',
             userId: mockUser.id,
        }));
        const createdNotificationInstance = Notification.mock.results[0].value;
        expect(createdNotificationInstance.save).toHaveBeenCalledTimes(1);
        expect(mockIo.emit).toHaveBeenCalledTimes(1);
        expect(mockIo.emit).toHaveBeenCalledWith('notification', expect.objectContaining({
            _id: 'notifId',
            projectId: { _id: mockCategoryProjectInstance._id, name: mockCategoryProjectInstance.name, type: 'category' }
        }));
        expect(result.message).toBe('Công trình đã được gửi để duyệt!');
        expect(result.project).toHaveProperty('_id', mockCategoryProjectInstance._id);
        expect(result.pending).toBe(true);
    });

    it('should create a new minor_repair project and notification', async () => {
         const projectData = {
            name: 'Test Minor Project',
            allocatedUnit: 'Unit B',
            location: 'Location Y',
            approvedBy: mockApprover._id,
            scale: 'Medium',
            reportDate: '2023-10-26',
        };

        const result = await projectService.createNewProject(projectData, mockUser, 'minor_repair', mockIo);

        expect(User.findById).toHaveBeenCalledWith(mockApprover._id);
        expect(MinorRepairProject).toHaveBeenCalledTimes(1);
        expect(MinorRepairProject).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Test Minor Project',
            allocatedUnit: 'Unit B',
            location: 'Location Y',
            approvedBy: mockApprover._id,
            scale: 'Medium',
            reportDate: '2023-10-26',
            enteredBy: mockUser.username,
            createdBy: mockUser.id,
        }));
        expect(mockMinorRepairProjectInstance.save).toHaveBeenCalledTimes(1);
        expect(populateProjectFields).toHaveBeenCalledTimes(1);
        expect(populateProjectFields).toHaveBeenCalledWith(mockMinorRepairProjectInstance);
        expect(Notification).toHaveBeenCalledTimes(1);
         expect(Notification).toHaveBeenCalledWith(expect.objectContaining({
             message: expect.stringContaining(`Yêu cầu thêm công trình mới "${mockMinorRepairProjectInstance.name}"`),
             type: 'new',
             projectId: mockMinorRepairProjectInstance._id,
             projectModel: 'MinorRepairProject',
             status: 'pending',
             userId: mockUser.id,
        }));
        const createdNotificationInstance = Notification.mock.results[0].value;
        expect(createdNotificationInstance.save).toHaveBeenCalledTimes(1);
        expect(mockIo.emit).toHaveBeenCalledTimes(1);
         expect(mockIo.emit).toHaveBeenCalledWith('notification', expect.objectContaining({
            _id: 'notifId',
            projectId: { _id: mockMinorRepairProjectInstance._id, name: mockMinorRepairProjectInstance.name, type: 'minor_repair' }
        }));
        expect(result.message).toBe('Công trình đã được gửi để duyệt!');
        expect(result.project).toHaveProperty('_id', mockMinorRepairProjectInstance._id);
        expect(result.pending).toBe(true);
    });


    it('should throw error if required fields are missing for category project', async () => {
        const projectData = { allocatedUnit: 'Unit A', location: 'Location X', type: 'category', approvedBy: mockApprover._id, scale: 'Small' };
        const user = { id: 'userId', username: 'testuser', permissions: { add: true } };
        const io = { emit: jest.fn() };
        await expect(projectService.createNewProject(projectData, user, 'category', io))
            .rejects.toThrow('Tên công trình, Đơn vị phân bổ, Địa điểm, Loại công trình và Người phê duyệt là bắt buộc.');
        expect(CategoryProject).not.toHaveBeenCalled();
        expect(Notification).not.toHaveBeenCalled();
        expect(io.emit).not.toHaveBeenCalled();
    });

    it('should throw error if scale or reportDate are missing for minor_repair project', async () => {
        const projectData = { name: 'Test Minor', allocatedUnit: 'Unit B', location: 'Location Y', type: 'minor_repair', approvedBy: mockApprover._id };
        const user = { id: 'userId', username: 'testuser', permissions: { add: true } };
        const io = { emit: jest.fn() };
        await expect(projectService.createNewProject(projectData, user, 'minor_repair', io))
            .rejects.toThrow('Quy mô và Ngày xảy ra sự cố là bắt buộc cho công trình sửa chữa nhỏ.');
    });

    it('should throw error if scale is missing for category project', async () => {
        const projectData = { name: 'Test Cat', allocatedUnit: 'Unit C', location: 'Location Z', type: 'category', approvedBy: mockApprover._id };
        const user = { id: 'userId', username: 'testuser', permissions: { add: true } };
        const io = { emit: jest.fn() };
        await expect(projectService.createNewProject(projectData, user, 'category', io))
            .rejects.toThrow('Quy mô là bắt buộc cho công trình danh mục.');
    });


     it('should throw error if approver is invalid or lacks permission', async () => {
        const projectData = { name: 'Test Cat Project', allocatedUnit: 'Unit A', location: 'Location X', type: 'category', approvedBy: 'invalidApproverId', scale: 'Small' };
        const user = { id: 'userId', username: 'testuser', permissions: { add: true } };
        const io = { emit: jest.fn() };
        User.findById.mockResolvedValueOnce(null);
        await expect(projectService.createNewProject(projectData, user, 'category', io)).rejects.toThrow('Người duyệt không hợp lệ hoặc không có quyền duyệt.');
        expect(User.findById).toHaveBeenCalledWith('invalidApproverId');
        expect(CategoryProject).not.toHaveBeenCalled();
        expect(Notification).not.toHaveBeenCalled();
        expect(io.emit).not.toHaveBeenCalled();
        User.findById.mockResolvedValueOnce({ _id: 'approverIdWithoutPermission', permissions: { approve: false } });
         await expect(projectService.createNewProject(projectData, user, 'category', io)).rejects.toThrow('Người duyệt không hợp lệ hoặc không có quyền duyệt.');
         expect(User.findById).toHaveBeenCalledWith('invalidApproverId');
         expect(CategoryProject).not.toHaveBeenCalled();
         expect(Notification).not.toHaveBeenCalled();
         expect(io.emit).not.toHaveBeenCalled();
    });
});


// Nhóm các test case cho hàm updateProjectById
describe('ProjectService - updateProjectById', () => {
    const mockExistingCategoryProject = {
        _id: 'existingCatProjectId',
        name: 'Existing Cat Project',
        status: 'Đã duyệt',
        enteredBy: 'regularuser',
        createdBy: 'existingUserId',
        save: jest.fn(),
        allocatedUnit: 'Old Unit',
        location: 'Old Location',
        scale: 'Old Scale',
        initialValue: 1000,
        pendingEdit: null,
        pendingDelete: false,
        // Thêm toObject để mock populateProjectFields có thể dùng
        toObject: function() { return { ...this }; }
    };

     const mockExistingMinorRepairProject = {
        _id: 'existingMinorProjectId',
        name: 'Existing Minor Project',
        status: 'Chờ duyệt',
        enteredBy: 'existinguser',
        createdBy: 'existingUserId',
        save: jest.fn(),
        allocatedUnit: 'Old Unit',
        location: 'Old Location',
        scale: 'Old Scale',
        reportDate: '2023-01-01',
        pendingEdit: null,
        pendingDelete: false,
        toObject: function() { return { ...this }; }
    };

    const mockAdminUser = { id: 'adminUserId', username: 'admin', role: 'admin', permissions: { add: true, edit: true, delete: true, approve: true } };
    const mockRegularUserWithEdit = { id: 'regularUserId', username: 'regularuser', role: 'user', permissions: { add: false, edit: true, delete: false, approve: false } };
    // const mockApproverUser = { id: 'approverUserId', username: 'approver', role: 'user', permissions: { add: false, edit: false, delete: false, approve: true } };


    beforeEach(() => {
        jest.clearAllMocks();

        Object.assign(mockExistingCategoryProject, {
            _id: 'existingCatProjectId', // Giữ _id cố định
            name: 'Existing Cat Project',
            status: 'Đã duyệt',
            enteredBy: 'regularuser',
            createdBy: 'existingUserId',
            allocatedUnit: 'Old Unit',
            location: 'Old Location',
            scale: 'Old Scale',
            initialValue: 1000,
            pendingEdit: null,
            pendingDelete: false,
        });
        mockExistingCategoryProject.save.mockResolvedValue({ ...mockExistingCategoryProject });


        Object.assign(mockExistingMinorRepairProject, {
            _id: 'existingMinorProjectId', // Giữ _id cố định
            name: 'Existing Minor Project',
            status: 'Chờ duyệt',
            enteredBy: 'existinguser', // Giữ nguyên cho các test khác
            createdBy: 'existingUserId',
            allocatedUnit: 'Old Unit',
            location: 'Old Location',
            scale: 'Old Scale',
            reportDate: '2023-01-01',
            pendingEdit: null,
            pendingDelete: false,
        });
        mockExistingMinorRepairProject.save.mockResolvedValue({ ...mockExistingMinorRepairProject });

         populateProjectFields.mockImplementation(doc => {
            // Đảm bảo doc không phải là null/undefined trước khi cố gắng gọi toObject hoặc spread
            if (!doc) return Promise.resolve(null);
            const plainDoc = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
            return Promise.resolve({
                ...plainDoc,
                createdBy: { _id: plainDoc.createdBy, fullName: 'Test Creator' },
                approvedBy: plainDoc.approvedBy ? { _id: plainDoc.approvedBy, fullName: 'Test Approver' } : null,
                pendingEdit: plainDoc.pendingEdit ? { ...plainDoc.pendingEdit, requestedBy: { _id: plainDoc.pendingEdit.requestedBy, fullName: 'Test Requester' } } : null,
            });
        });

        const mockUpdateNotificationInstance = {
            _id: 'updateNotifId',
            save: jest.fn(),
            toObject: jest.fn().mockReturnValue({ _id: 'updateNotifId' }),
        };
        mockUpdateNotificationInstance.save.mockResolvedValue(mockUpdateNotificationInstance);

        Notification.mockImplementation(() => {
            return mockUpdateNotificationInstance;
        });
    });

    it('should update project directly if user has edit permission and project is not approved', async () => {
        mockExistingMinorRepairProject.status = 'Chờ duyệt';
        MinorRepairProject.findById.mockResolvedValue(mockExistingMinorRepairProject);

        const updateData = { name: 'Updated Minor Project', location: 'New Location' };
        const user = mockRegularUserWithEdit;
        const io = { emit: jest.fn() };

        const result = await projectService.updateProjectById(mockExistingMinorRepairProject._id, 'minor_repair', updateData, user, io);

        expect(MinorRepairProject.findById).toHaveBeenCalledWith(mockExistingMinorRepairProject._id);
        expect(mockExistingMinorRepairProject.name).toBe('Updated Minor Project');
        expect(mockExistingMinorRepairProject.location).toBe('New Location');
        expect(mockExistingMinorRepairProject.save).toHaveBeenCalledTimes(1);
        expect(mockExistingMinorRepairProject.pendingEdit).toBeNull();
        expect(populateProjectFields).toHaveBeenCalledTimes(1);
        expect(Notification).not.toHaveBeenCalled();
        expect(io.emit).not.toHaveBeenCalled();
        expect(result.message).toBe('Công trình đã được cập nhật.');
        expect(result.project).toHaveProperty('_id', mockExistingMinorRepairProject._id);
        expect(result.updated).toBe(true);
        expect(result.pending).toBeUndefined();
    });

    it('should create pending edit request if user has edit permission and project is approved', async () => {
        mockExistingCategoryProject.enteredBy = 'regularuser';
        mockExistingCategoryProject.status = 'Đã duyệt';
        mockExistingCategoryProject.pendingEdit = null;
        CategoryProject.findById.mockResolvedValue(mockExistingCategoryProject);

        const updateData = { name: 'Updated Cat Project', initialValue: 5000 };
        const user = mockRegularUserWithEdit;
        const io = { emit: jest.fn() };

        const result = await projectService.updateProjectById(mockExistingCategoryProject._id, 'category', updateData, user, io);

        expect(CategoryProject.findById).toHaveBeenCalledWith(mockExistingCategoryProject._id);
        expect(mockExistingCategoryProject.pendingEdit).not.toBeNull();
        expect(mockExistingCategoryProject.pendingEdit.requestedBy).toBe(user.id);
        expect(mockExistingCategoryProject.pendingEdit.changes).toEqual(expect.arrayContaining([
            { field: 'name', oldValue: 'Existing Cat Project', newValue: 'Updated Cat Project' },
            { field: 'initialValue', oldValue: 1000, newValue: 5000 },
        ]));
        expect(mockExistingCategoryProject.save).toHaveBeenCalledTimes(1);
        expect(populateProjectFields).toHaveBeenCalledTimes(1);
        expect(Notification).toHaveBeenCalledTimes(1);
         expect(Notification).toHaveBeenCalledWith(expect.objectContaining({
             message: expect.stringContaining(`Yêu cầu sửa công trình "${mockExistingCategoryProject.name}" bởi ${user.username}`),
             type: 'edit',
             projectId: mockExistingCategoryProject._id,
             projectModel: 'CategoryProject',
             status: 'pending',
             userId: user.id,
        }));
        const createdNotificationInstance = Notification.mock.results[0].value;
        expect(io.emit).toHaveBeenCalledTimes(1);
         expect(io.emit).toHaveBeenCalledWith('notification', expect.objectContaining({
            _id: createdNotificationInstance._id,
            projectId: { _id: mockExistingCategoryProject._id, name: 'Existing Cat Project', type: 'category' } // name gốc trước khi duyệt sửa
         }));
        expect(result.message).toBe('Yêu cầu sửa đã được gửi để chờ duyệt');
        expect(result.project).toHaveProperty('_id', mockExistingCategoryProject._id);
        expect(result.updated).toBe(true);
        expect(result.pending).toBe(true);
    });

     it('should update project directly if user is Admin even if project is approved', async () => {
        Object.assign(mockExistingCategoryProject, {
            status: 'Đã duyệt',
            name: 'Existing Cat Project',
            initialValue: 1000,
            pendingEdit: null,
        });
        CategoryProject.findById.mockResolvedValue(mockExistingCategoryProject);

        const updateData = { name: 'Admin Updated Cat Project', initialValue: 6000 };
        const user = mockAdminUser;
        const io = { emit: jest.fn() };

        const result = await projectService.updateProjectById(mockExistingCategoryProject._id, 'category', updateData, user, io);

        expect(CategoryProject.findById).toHaveBeenCalledWith(mockExistingCategoryProject._id);
        
        expect(mockExistingCategoryProject.pendingEdit).toBeNull();
        expect(mockExistingCategoryProject.save).toHaveBeenCalledTimes(1);
        // Kiểm tra các giá trị đã được cập nhật trên mockExistingCategoryProject
        expect(mockExistingCategoryProject.name).toEqual(updateData.name);
        expect(mockExistingCategoryProject.initialValue).toEqual(updateData.initialValue);

        expect(result.message).toBe('Công trình đã được cập nhật.');
        expect(result.project).toHaveProperty('name', 'Admin Updated Cat Project');
        expect(result.project).toHaveProperty('initialValue', 6000);
        expect(result.updated).toBe(true);
        expect(result.pending).toBeUndefined();
        expect(populateProjectFields).toHaveBeenCalledTimes(1);
        expect(Notification).not.toHaveBeenCalled();
        expect(io.emit).not.toHaveBeenCalled();

    });


    it('should throw 403 error if user does not have edit permission', async () => {
        mockExistingCategoryProject.status = 'Đã duyệt';
        CategoryProject.findById.mockResolvedValue(mockExistingCategoryProject);
        const updateData = { name: 'Attempted Update' };
        const user = { id: 'noEditUserId', username: 'noedituser', role: 'user', permissions: { add: false, edit: false, delete: false, approve: false } };
        const io = { emit: jest.fn() };
        await expect(projectService.updateProjectById(mockExistingCategoryProject._id, 'category', updateData, user, io))
            .rejects.toThrow('Không có quyền sửa công trình này hoặc gửi yêu cầu sửa.');
        expect(CategoryProject.findById).toHaveBeenCalledWith(mockExistingCategoryProject._id);
        expect(mockExistingCategoryProject.save).not.toHaveBeenCalled();
        expect(Notification).not.toHaveBeenCalled();
        expect(io.emit).not.toHaveBeenCalled();
    });

    it('should throw 404 error if project is not found', async () => {
        CategoryProject.findById.mockResolvedValue(null);
        const updateData = { name: 'Attempted Update' };
        const user = mockRegularUserWithEdit;
        const io = { emit: jest.fn() };
        await expect(projectService.updateProjectById('nonExistentId', 'category', updateData, user, io))
            .rejects.toThrow('Không tìm thấy công trình');
        expect(CategoryProject.findById).toHaveBeenCalledWith('nonExistentId');
        // expect(mockExistingCategoryProject.save).not.toHaveBeenCalled(); // Không thể kiểm tra vì mockExistingCategoryProject không liên quan
        expect(Notification).not.toHaveBeenCalled();
        expect(io.emit).not.toHaveBeenCalled();
    });

    it('should return message if no changes are detected for pending edit request', async () => {
        mockExistingCategoryProject.status = 'Đã duyệt';
        mockExistingCategoryProject.enteredBy = 'regularuser'; // Khớp với user
        mockExistingCategoryProject.pendingEdit = null;
        CategoryProject.findById.mockResolvedValue(mockExistingCategoryProject);
        const updateData = {
            name: mockExistingCategoryProject.name, // Giống tên cũ
            initialValue: mockExistingCategoryProject.initialValue, // Giống giá trị cũ
        };
        const user = mockRegularUserWithEdit;
        const io = { emit: jest.fn() };
        const result = await projectService.updateProjectById(mockExistingCategoryProject._id, 'category', updateData, user, io);
        expect(CategoryProject.findById).toHaveBeenCalledWith(mockExistingCategoryProject._id);
        expect(mockExistingCategoryProject.pendingEdit).toBeNull();
        expect(mockExistingCategoryProject.save).not.toHaveBeenCalled();
        expect(populateProjectFields).toHaveBeenCalledTimes(1);
        expect(Notification).not.toHaveBeenCalled();
        expect(io.emit).not.toHaveBeenCalled();
        expect(result.message).toBe('Không có thay đổi nào được ghi nhận để yêu cầu sửa.');
        expect(result.project).toHaveProperty('_id', mockExistingCategoryProject._id);
        expect(result.updated).toBe(false);
        expect(result.pending).toBeUndefined();
    });
});

// Nhóm các test case cho hàm deleteProjectById
describe('ProjectService - deleteProjectById', () => {
     // Mock dữ liệu project hiện có
    const mockExistingCategoryProjectPendingDelete = {
        _id: 'existingCatProjectIdPendingDelete',
        name: 'Cat Project Pending Delete',
        status: 'Đã duyệt',
        pendingDelete: true, // Đang chờ duyệt xóa
        enteredBy: 'existinguser',
        createdBy: 'existingUserId',
        // toObject: jest.fn().mockReturnThis(), // Không cần thiết nếu populateProjectFields được mock tốt
        save: jest.fn(),
    };

     const mockExistingMinorRepairProjectNotApproved = {
        _id: 'existingMinorProjectIdNotApproved',
        name: 'Minor Project Not Approved',
        status: 'Chờ duyệt', // Chưa duyệt
        pendingDelete: false,
        enteredBy: 'existinguser',
        createdBy: 'existingUserId',
        // toObject: jest.fn().mockReturnThis(),
        save: jest.fn(),
    };

    // Mock user với các quyền khác nhau
    const mockAdminUser = { id: 'adminUserId', username: 'admin', role: 'admin', permissions: { add: true, edit: true, delete: true, approve: true } };
    const mockRegularUserWithDelete = { id: 'regularUserId', username: 'regularuser', role: 'user', permissions: { add: false, edit: false, delete: true, approve: false } };
    const mockApproverUser = { id: 'approverUserId', username: 'approver', role: 'user', permissions: { add: false, edit: false, delete: false, approve: true } };

    // Khai báo mockFoundNotificationInstance ở phạm vi describe
    let mockFoundNotificationInstance;


    beforeEach(() => {
        jest.clearAllMocks();

        // Reset mock project states
        Object.assign(mockExistingCategoryProjectPendingDelete, {
            name: 'Cat Project Pending Delete',
            status: 'Đã duyệt',
            pendingDelete: true,
        });
        Object.assign(mockExistingMinorRepairProjectNotApproved, {
            name: 'Minor Project Not Approved',
            status: 'Chờ duyệt',
            pendingDelete: false,
        });

        // Mock deleteOne trên Model
        CategoryProject.deleteOne.mockResolvedValue({ deletedCount: 1 });
        MinorRepairProject.deleteOne.mockResolvedValue({ deletedCount: 1 });

        // Mock cho Notification.findOne
        // Gán giá trị cho mockFoundNotificationInstance đã khai báo ở trên
        mockFoundNotificationInstance = {
            _id: 'deleteNotifId',
            status: 'pending', // Giả sử ban đầu là pending
            save: jest.fn(),
            toObject: jest.fn().mockReturnValue({ _id: 'deleteNotifId', status: 'pending' }),
        };
        mockFoundNotificationInstance.save.mockResolvedValue(mockFoundNotificationInstance);
        Notification.findOne.mockResolvedValue(mockFoundNotificationInstance);

        // Mock cho new Notification() (constructor)
        // Sẽ tạo một instance mới mỗi lần gọi, với hàm save riêng
        Notification.mockImplementation(() => {
            const newInstance = {
                save: jest.fn().mockResolvedValue({ toObject: () => ({ _id: 'newDeleteNotifId' }) }), // Giả lập save trả về object có toObject
                toObject: jest.fn().mockReturnValue({ _id: 'newDeleteNotifId' })
            };
            return newInstance;
        });

        // Mock updateSerialNumbers
        updateSerialNumbers.mockResolvedValue(true);
    });

    // Test case 1: Admin xóa công trình chưa duyệt -> Xóa thành công
    it('should delete not approved project if user is Admin', async () => {
        // Cấu hình project chưa duyệt
        mockExistingCategoryProjectPendingDelete.status = 'Chờ duyệt'; // Đảm bảo trạng thái là chưa duyệt
        mockExistingCategoryProjectPendingDelete.pendingDelete = false; // Đảm bảo không phải yêu cầu xóa
        // Mock findById để trả về project cho test case này
        CategoryProject.findById.mockResolvedValue(mockExistingCategoryProjectPendingDelete);

        const user = mockAdminUser;
        const io = { emit: jest.fn() };

        const result = await projectService.deleteProjectById(mockExistingCategoryProjectPendingDelete._id, 'category', user, io);

        // Kiểm tra findById được gọi
        expect(CategoryProject.findById).toHaveBeenCalledWith(mockExistingCategoryProjectPendingDelete._id);
        // Kiểm tra deleteOne được gọi
        expect(CategoryProject.deleteOne).toHaveBeenCalledWith({ _id: mockExistingCategoryProjectPendingDelete._id });
        // Kiểm tra updateSerialNumbers được gọi
        expect(updateSerialNumbers).toHaveBeenCalledWith('category');
        // Kiểm tra Notification.findOne có được gọi để tìm notification pending không
        expect(Notification.findOne).toHaveBeenCalledWith({
             projectId: mockExistingCategoryProjectPendingDelete._id,
             status: 'pending',
             type: 'delete',
             projectModel: 'CategoryProject'
        });
        // Kiểm tra notification pending (nếu tìm thấy) được đánh dấu processed
        // const foundPendingNotification = await Notification.findOne(); // Không cần gọi lại ở đây, findOne đã được mock
        const foundPendingNotification = mockFoundNotificationInstance; // Sử dụng instance đã được mock cho findOne
        expect(foundPendingNotification.status).toBe('processed');
        expect(foundPendingNotification.save).toHaveBeenCalledTimes(1);

        // Kiểm tra notification mới (đã xóa bởi admin) được tạo và lưu
        // Notification constructor được gọi 1 lần cho notification mới
        expect(Notification).toHaveBeenCalledTimes(1); // Chỉ constructor cho notif mới
         expect(Notification).toHaveBeenCalledWith(expect.objectContaining({
             message: expect.stringContaining(`Công trình "${mockExistingCategoryProjectPendingDelete.name}" đã được xóa bởi ${user.username}`),
             type: 'delete',
             projectId: mockExistingCategoryProjectPendingDelete._id,
             projectModel: 'CategoryProject',
             status: 'processed',
             userId: mockExistingCategoryProjectPendingDelete.createdBy
        }));
        const createdDeletedNotification = Notification.mock.results[0].value; // Lấy instance từ constructor
        expect(createdDeletedNotification.save).toHaveBeenCalledTimes(1);

        // Kiểm tra io.emit được gọi
        expect(io.emit).toHaveBeenCalledTimes(3); // 1 cho processed, 1 cho new, 1 cho project_deleted
        expect(io.emit).toHaveBeenCalledWith('notification_processed', foundPendingNotification._id);
        expect(io.emit).toHaveBeenCalledWith('notification', createdDeletedNotification);
        expect(io.emit).toHaveBeenCalledWith('project_deleted', { projectId: mockExistingCategoryProjectPendingDelete._id, projectType: 'category' });

        // Kiểm tra kết quả trả về
        expect(result.message).toBe('Công trình đã được xóa thành công.');
    });

    // Test case 2: User có quyền delete xóa công trình chưa duyệt -> Xóa thành công
     it('should delete not approved project if user has delete permission', async () => {
        // Cấu hình project chưa duyệt
        mockExistingMinorRepairProjectNotApproved.status = 'Chờ duyệt'; // Đảm bảo trạng thái là chưa duyệt
        mockExistingMinorRepairProjectNotApproved.pendingDelete = false; // Đảm bảo không phải yêu cầu xóa
        MinorRepairProject.findById.mockResolvedValue(mockExistingMinorRepairProjectNotApproved);

        const user = mockRegularUserWithDelete; // User có quyền delete
        const io = { emit: jest.fn() };

        const result = await projectService.deleteProjectById(mockExistingMinorRepairProjectNotApproved._id, 'minor_repair', user, io);

        // Kiểm tra findById được gọi
        expect(MinorRepairProject.findById).toHaveBeenCalledWith(mockExistingMinorRepairProjectNotApproved._id);
        // Kiểm tra deleteOne được gọi
        expect(MinorRepairProject.deleteOne).toHaveBeenCalledWith({ _id: mockExistingMinorRepairProjectNotApproved._id });
        // Kiểm tra updateSerialNumbers được gọi
        expect(updateSerialNumbers).toHaveBeenCalledWith('minor_repair');
        // Kiểm tra Notification.findOne có được gọi để tìm notification pending không
        expect(Notification.findOne).toHaveBeenCalledWith({
             projectId: mockExistingMinorRepairProjectNotApproved._id,
             status: 'pending',
             type: 'delete',
             projectModel: 'MinorRepairProject'
        });
         // Kiểm tra notification pending (nếu tìm thấy) được đánh dấu processed
        // const foundPendingNotification = await Notification.findOne();
        const foundPendingNotification = mockFoundNotificationInstance;
        expect(foundPendingNotification.status).toBe('processed');
        expect(foundPendingNotification.save).toHaveBeenCalledTimes(1);
        // Kiểm tra notification mới (đã xóa bởi user) được tạo và lưu
        expect(Notification).toHaveBeenCalledTimes(1);
         expect(Notification).toHaveBeenCalledWith(expect.objectContaining({
             message: expect.stringContaining(`Công trình "${mockExistingMinorRepairProjectNotApproved.name}" đã được xóa bởi ${user.username}`),
             type: 'delete',
             projectId: mockExistingMinorRepairProjectNotApproved._id,
             projectModel: 'MinorRepairProject',
             status: 'processed',
             userId: mockExistingMinorRepairProjectNotApproved.createdBy
        }));
        const createdDeletedNotification = Notification.mock.results[0].value;
        expect(createdDeletedNotification.save).toHaveBeenCalledTimes(1);
        // Kiểm tra io.emit được gọi
        expect(io.emit).toHaveBeenCalledTimes(3);
        expect(io.emit).toHaveBeenCalledWith('notification_processed', foundPendingNotification._id);
        expect(io.emit).toHaveBeenCalledWith('notification', createdDeletedNotification);
        expect(io.emit).toHaveBeenCalledWith('project_deleted', { projectId: mockExistingMinorRepairProjectNotApproved._id, projectType: 'minor_repair' });

        // Kiểm tra kết quả trả về
        expect(result.message).toBe('Công trình đã được xóa thành công.');
    });


    // Test case 3: Approver duyệt yêu cầu xóa (project.pendingDelete = true) -> Xóa thành công
    it('should delete project if user is Approver and project has pendingDelete true', async () => {
        // Cấu hình project đang chờ duyệt xóa
        mockExistingCategoryProjectPendingDelete.status = 'Đã duyệt'; // Trạng thái đã duyệt
        mockExistingCategoryProjectPendingDelete.pendingDelete = true; // Đang chờ duyệt xóa
        CategoryProject.findById.mockResolvedValue(mockExistingCategoryProjectPendingDelete);

        const user = mockApproverUser; // User có quyền approve
        const io = { emit: jest.fn() };

        const result = await projectService.deleteProjectById(mockExistingCategoryProjectPendingDelete._id, 'category', user, io);

        // Kiểm tra findById được gọi
        expect(CategoryProject.findById).toHaveBeenCalledWith(mockExistingCategoryProjectPendingDelete._id);
        // Kiểm tra deleteOne được gọi
        expect(CategoryProject.deleteOne).toHaveBeenCalledWith({ _id: mockExistingCategoryProjectPendingDelete._id });
        // Kiểm tra updateSerialNumbers được gọi
        expect(updateSerialNumbers).toHaveBeenCalledWith('category');
        // Kiểm tra Notification.findOne có được gọi để tìm notification pending không
         expect(Notification.findOne).toHaveBeenCalledWith({
             projectId: mockExistingCategoryProjectPendingDelete._id,
             type: 'delete',
             status: 'pending',
             projectModel: 'CategoryProject'
        });
        // Kiểm tra notification pending (nếu tìm thấy) được đánh dấu processed
        // const foundPendingNotification = await Notification.findOne();
        const foundPendingNotification = mockFoundNotificationInstance;
        expect(foundPendingNotification.status).toBe('processed');
        expect(foundPendingNotification.save).toHaveBeenCalledTimes(1);
        // Kiểm tra notification mới (yêu cầu xóa đã duyệt) được tạo và lưu
        expect(Notification).toHaveBeenCalledTimes(1);
         expect(Notification).toHaveBeenCalledWith(expect.objectContaining({
             message: expect.stringContaining(`Yêu cầu xóa công trình "${mockExistingCategoryProjectPendingDelete.name}" đã được duyệt`),
             type: 'delete', // Service hiện tại vẫn dùng type 'delete'
             // projectId: mockExistingCategoryProjectPendingDelete._id, // projectId có thể không tồn tại sau khi xóa
             projectModel: 'CategoryProject',
             status: 'processed',
             userId: mockExistingCategoryProjectPendingDelete.createdBy
        }));
        const createdApprovedDeleteNotification = Notification.mock.results[0].value;
        expect(createdApprovedDeleteNotification.save).toHaveBeenCalledTimes(1);
        // Kiểm tra io.emit được gọi
        expect(io.emit).toHaveBeenCalledTimes(3);
        expect(io.emit).toHaveBeenCalledWith('notification_processed', foundPendingNotification._id);
        expect(io.emit).toHaveBeenCalledWith('notification', createdApprovedDeleteNotification);
        expect(io.emit).toHaveBeenCalledWith('project_deleted', { projectId: mockExistingCategoryProjectPendingDelete._id, projectType: 'category' });

        // Kiểm tra kết quả trả về
        expect(result.message).toBe('Đã xóa công trình (sau khi duyệt yêu cầu).');
    });


    // Test case 4: Project không tồn tại -> Ném lỗi 404
    it('should throw 404 error if project is not found', async () => {
        CategoryProject.findById.mockResolvedValue(null); // Giả lập không tìm thấy project

        const user = mockAdminUser; // Quyền không quan trọng nếu project không tồn tại
        const io = { emit: jest.fn() };

        await expect(projectService.deleteProjectById('nonExistentId', 'category', user, io))
            .rejects.toThrow('Không tìm thấy công trình');

        expect(CategoryProject.findById).toHaveBeenCalledWith('nonExistentId');
        // Kiểm tra deleteOne KHÔNG được gọi
        expect(CategoryProject.deleteOne).not.toHaveBeenCalled();
        // Kiểm tra updateSerialNumbers KHÔNG được gọi
        expect(updateSerialNumbers).not.toHaveBeenCalled();
        // Kiểm tra Notification KHÔNG được tạo/tìm
        expect(Notification).not.toHaveBeenCalled();
        // Kiểm tra io.emit KHÔNG được gọi
        expect(io.emit).not.toHaveBeenCalled();
    });

    // Test case 5: User không có quyền xóa và project đã duyệt và không pending delete -> Ném lỗi 403
    it('should throw 403 error if user does not have permission and project is approved and not pending delete', async () => {
         // Cấu hình project đã duyệt và không pending delete
        mockExistingCategoryProjectPendingDelete.status = 'Đã duyệt';
        mockExistingCategoryProjectPendingDelete.pendingDelete = false;
        CategoryProject.findById.mockResolvedValue(mockExistingCategoryProjectPendingDelete);

        const user = { id: 'noDeleteUserId', username: 'nodeleteuser', role: 'user', permissions: { add: false, edit: false, delete: false, approve: false } }; // User không có quyền delete
        const io = { emit: jest.fn() };

        await expect(projectService.deleteProjectById(mockExistingCategoryProjectPendingDelete._id, 'category', user, io))
            .rejects.toThrow('Hành động xóa không được phép hoặc không phù hợp với trạng thái hiện tại của công trình từ service.'); // Message từ service

        expect(CategoryProject.findById).toHaveBeenCalledWith(mockExistingCategoryProjectPendingDelete._id);
        // Kiểm tra deleteOne KHÔNG được gọi
        expect(CategoryProject.deleteOne).not.toHaveBeenCalled();
        // Kiểm tra updateSerialNumbers KHÔNG được gọi
        expect(updateSerialNumbers).not.toHaveBeenCalled();
        // Kiểm tra Notification KHÔNG được tạo/tìm
        expect(Notification).not.toHaveBeenCalled();
        // Kiểm tra io.emit KHÔNG được gọi
        expect(io.emit).not.toHaveBeenCalled();
    });

    // Test case 6: User có quyền delete nhưng project đã duyệt và không pending delete -> Logic yêu cầu xóa (xử lý ở controller)
    // Service này không xử lý trường hợp này, nó sẽ ném lỗi 403 với message từ service
     it('should throw 403 error if user has delete permission but project is approved and not pending delete (handled by controller)', async () => {
         // Cấu hình project đã duyệt và không pending delete
        mockExistingCategoryProjectPendingDelete.status = 'Đã duyệt';
        mockExistingCategoryProjectPendingDelete.pendingDelete = false;
        CategoryProject.findById.mockResolvedValue(mockExistingCategoryProjectPendingDelete);

        const user = mockRegularUserWithDelete; // User có quyền delete
        const io = { emit: jest.fn() };

        await expect(projectService.deleteProjectById(mockExistingCategoryProjectPendingDelete._id, 'category', user, io))
            .rejects.toThrow('Hành động xóa không được phép hoặc không phù hợp với trạng thái hiện tại của công trình từ service.'); // Message từ service

        expect(CategoryProject.findById).toHaveBeenCalledWith(mockExistingCategoryProjectPendingDelete._id);
        // Kiểm tra deleteOne KHÔNG được gọi
        expect(CategoryProject.deleteOne).not.toHaveBeenCalled();
        // Kiểm tra updateSerialNumbers KHÔNG được gọi
        expect(updateSerialNumbers).not.toHaveBeenCalled();
        // Kiểm tra Notification KHÔNG được tạo/tìm
        expect(Notification).not.toHaveBeenCalled();
        // Kiểm tra io.emit KHÔNG được gọi
        expect(io.emit).not.toHaveBeenCalled();
    });


    // Thêm các test case khác:
    // - Test với minor_repair project
    // - Test khi Notification.findOne không tìm thấy notification pending
});
