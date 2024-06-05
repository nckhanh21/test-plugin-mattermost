// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import moment from 'moment';
import dayjs from 'dayjs';

import {
    makeStyleFromTheme,
    changeOpacity,
} from 'mattermost-redux/utils/theme_utils';
import { Button, Col, DatePicker, Form, Input, Modal, notification, Popover, Row, Select, Table } from 'antd';
import { BsThreeDots } from "react-icons/bs";

import './todo_editor.scss';
import TodoItem from '../todo_item';
import Tada from '../../illustrations/tada';
import { apiCategory } from '../../api/category';
import { apiAuth } from '../../api/auth';
import { apiRequest } from '../../api/request';
import { apiUser } from '../../api/user';
import { apiAction } from '../../api/action';


axios.defaults.withCredentials = true;

function ToDoEditor(props) {
    const style = getStyle(props.theme);
    const { theme, siteURL, accept, complete, list, remove, bump, addVisible, issues, numberCallApi } = props;
    const [formForward] = Form.useForm(); // Form chuyển tiếp kiến nghị
    const [formEdit] = Form.useForm(); // Form sửa kiến nghị
    const [isLogin, setIsLogin] = React.useState(false);
    const [lstRequest, setLstRequest] = useState([]);
    const [isOpenModalView, setIsOpenModalView] = useState(false); // Mở modal xem chi tiết kiến nghị
    const [isOpenModalEdit, setIsOpenModalEdit] = useState(false); // Mở modal sửa kiến nghị
    const [isOpenModalForward, setIsOpenModalForward] = useState(false); // Mở modal chuyển tiếp kiến nghị
    const [requestChoose, setRequestChoose] = useState({}); // Kiến nghị cần chuyển tiếp
    const [pageSize, setPageSize] = useState(10); // Số lượng kiến nghị trên 1 trang
    const [duplicatedKeys, setDuplicatedKeys] = useState([]);
    const [isShowModalDuplicate, setIsShowModalDuplicate] = useState(false); // Mở modal gán trùng kiến nghị
    const [lstDuplicateRequest, setLstDuplicateRequest] = useState([]); // Danh sách kiến nghị trùng
    const [lstCategory, setLstCategory] = useState([]); // Danh sách lĩnh vực
    const [lstUser, setLstUser] = useState([]); // Danh sách người dùng
    const [lstAction, setLstAction] = useState([]); // Danh sách hành động
    const [userId, setUserId] = useState(''); // Id người dùng

    const columns = [
        {
            title: 'STT',
            dataIndex: 'key',
            key: 'key',
        },
        {
            title: 'Tiêu đề',
            dataIndex: 'title',
            key: 'title',
        },
        {
            title: 'Nội dung',
            dataIndex: 'content',
            key: 'content',
            width: '30%',
        },
        {
            title: 'Ngày tạo',
            dataIndex: 'createDate',
            key: 'createDate',
        },
        {
            title: 'Lĩnh vực',
            dataIndex: 'category',
            key: 'category',
        },
        {
            title: 'Tình trạng',
            dataIndex: 'statusRequest',
            key: 'statusRequest',
        },

        {
            title: 'Hành động',
            key: 'action',
            render: (text, record) => (
                <span style={{
                    cursor: 'pointer',
                }}>
                    <Popover
                        content={
                            <div className='content-action'>
                                <div className='content-action-item' onClick={() => handleViewRequest(record)}>Xem chi tiết</div>
                                <div className='content-action-item' onClick={() => handleEditRequest(record)}>Sửa</div>
                                <div className='content-action-item' onClick={() => handleDuplicateRequest(record)}>Gán trùng</div>
                                <div className='content-action-item' onClick={() => handleForward(record)}>Chuyển tiếp</div>
                            </div>
                        }
                        trigger="hover">
                        <BsThreeDots />
                    </Popover>
                </span>
            ),
        },
    ]

    const columnsDuplicate = [
        {
            title: 'STT',
            dataIndex: 'key',
            key: 'key',
        },
        {
            title: 'Tiêu đề',
            dataIndex: 'title',
            key: 'title',
        },
        {
            title: 'Nội dung',
            dataIndex: 'content',
            key: 'content',
        },
        {
            title: 'Ngày tạo',
            dataIndex: 'createDate',
            key: 'createDate',
        },
        {
            title: 'Lĩnh vực',
            dataIndex: 'category',
            key: 'category',
        },
        {
            title: 'Tình trạng',
            dataIndex: 'statusRequest',
            key: 'statusRequest',
        },

        {
            title: 'Xác nhận trùng',
            key: 'action',
            render: (text, record) => (
                <Button className='button-primary' type='primary' onClick={() => handleRequestNotDuplicate(record)}>Không trùng</Button>
            ),
        },
    ]

    useEffect(() => {
        if (isLogin) {
            getAllRequest();
            getAllCategory();
            getAllUser();
            getAllAction();
        }
        !isLogin && loginUser();

    }, [isLogin]);

    useEffect(() => {
        isLogin && getAllRequest();
    }, [numberCallApi]);

    const getAllCategory = async () => {
        await apiCategory.getAll()
            .then((res) => {
                console.log(res.data.data);
                if (res.data.data) {
                    setLstCategory(res.data.data);
                }

            })
            .catch((err) => {
                console.log(err);
            });
    }

    const loginUser = async () => {

        const req = {
            username: 'username2',
            password: 'password2'
        }

        await apiAuth.login(req)
            .then((res) => {
                console.log(res);
                if (res.data.message === 'Đăng nhập thành công') {
                    setIsLogin(true);
                    setUserId(res.data.data._id);
                }
                else {
                    setIsLogin(false);
                }
            })
            .catch((err) => {
                console.log(err);
            });
    }

    const getAllAction = async () => {
        await apiAction.getAll()
            .then((res) => {
                console.log(res.data.data);
                if (res.data.data) {
                    setLstAction(res.data.data);
                }
            })
            .catch((err) => {
                console.log(err);
            });
    }

    const getAllUser = async () => {
        await apiUser.getAll()
            .then((res) => {
                console.log(res.data.data);
                // Lọc ra những user có role là user
                res.data.data = res.data.data.filter((user) => {
                    return user.fullname !== 'Admin';
                });

                if (res.data.data) {
                    setLstUser(res.data.data);
                }
            })
            .catch((err) => {
                console.log(err);
            });
    }

    const diableAction = (record) => {
        if (record.people._id === userId) {
            if (record.process[0].action.actionName === 'Xem') {
                return true;
            }
        }
        else {
            record.process.map((item) => {
                if (item.people._id === userId) {
                    if (item.action.actionName === 'Xem') {
                        return true;
                    }
                }
            })
        }
        return false;
    }

    const getAllRequest = async () => {
        await apiRequest.getAll()
            .then((res) => {
                console.log(res.data.data);
                const data = res.data.data.map((item, index) => {
                    console.log(item.category.description);
                    return {
                        id: item._id,
                        key: (index + 1).toString(),
                        title: item.title,
                        content: item.content,
                        createDate: moment(item.createdDate).format('DD/MM/YYYY'),
                        priority: item.priority,
                        category: item.category.description,
                        categoryId: item.category._id,
                        statusRequest: item.status,
                        people: item.people,
                        process: item.processes,
                    }
                }).filter((item) => item.statusRequest === "Bien tap");
                console.log(data);

                setLstRequest(data);
            })
            .catch((err) => {
                console.log(err);
            });
    }

    // Hàm xử lý khi xem chi tiết kiến nghị
    const handleViewRequest = (record) => {
        console.log(record);
        setIsOpenModalView(true);
        setRequestChoose(record);
    }

    // Hàm xử lý khi trùng kiến nghị
    const handleDuplicateRequest = (record) => {
        console.log(record);

        // Kiểm tra nếu kiến nghị không trùng với duplicatedKeys thì không hiển thị modal và cho notification
        if (!duplicatedKeys.includes(record.key)) {
            notification.error({
                message: 'Gán trùng không thành công!',
                description: 'Kiến nghị không trùng với kiến nghị nào!',
                duration: 3,
            });
            return;
        }

        setIsShowModalDuplicate(true);
        const lst = lstRequest.filter(item => duplicatedKeys.includes(item.key));
        setLstDuplicateRequest(lst);

        // Modal.confirm({
        //     title: 'Gán trùng kiến nghị',
        //     content: 'Bạn có chắc chắn muốn gán trùng kiến nghị này không?',
        //     okText: 'Gán trùng',
        //     cancelText: 'Hủy',
        //     onOk() {
        //         notification.success({
        //             message: 'Gán trùng thành công!',
        //             description: 'Gán trùng kiến nghị thành công!',
        //             duration: 3,
        //         });
        //         setDuplicatedKeys(prevKeys => [...prevKeys, record.key]);
        //     },
        //     onCancel() {
        //         console.log('Cancel');
        //     },
        // });
    }

    const handleRequestNotDuplicate = (record) => {
        // Xóa key của kiến nghị không trùng khỏi duplicatedKeys
        setDuplicatedKeys(prevKeys => prevKeys.filter(key => key !== record.key));
        setIsShowModalDuplicate(false);

        notification.success({
            message: 'Xóa trùng thành công!',
            description: 'Xóa trùng kiến nghị thành công!',
            duration: 3,
        });
    }

    // Hàm xử lý khi chuyển tiếp kiến nghị
    const handleForward = (record) => {
        console.log(record);
        setIsOpenModalForward(true);
        setRequestChoose(record);
    }

    // Hàm xử lý khi chuyển tiếp kiến nghị thành công
    const handleOkModalForward = async () => {
        console.log(formForward.getFieldsValue());
        console.log(requestChoose);

        const { persionForwardTo, actionForward } = formForward.getFieldsValue();

        const req = {
            peopleId: persionForwardTo,
            actionId: actionForward,
        }

        await apiRequest.forward(requestChoose.id, req)
            .then((res) => {
                console.log(res.data);
                if (res.data.message !== 'Chuyển tiếp thành công') {
                    notification.error({
                        message: 'Chuyển tiếp thất bại!',
                        description: res.data.message,
                        duration: 3,
                    });
                }
                else {
                    notification.success({
                        message: 'Chuyển tiếp thành công!',
                        description: 'Chuyển tiếp kiến nghị thành công!',
                        duration: 3,
                    });
                    setIsOpenModalForward(false);
                    formForward.resetFields();
                    getAllRequest();
                }
            })
            .catch((err) => {
                console.log(err);
            });

    }

    // Hàm xử lý khi đóng modal chuyển tiếp kiến nghị
    const handleCloseModalForward = () => {
        setIsOpenModalForward(false);
        formForward.resetFields();
    }

    // Hàm xử lý khi sửa kiến nghị
    const handleEditRequest = (record) => {
        console.log(record);
        setIsOpenModalEdit(true);
        setRequestChoose(record);

        console.log(record.createDate);

        const dateTime = dayjs(record.createDate, 'DD/MM/YYYY');

        formEdit.setFieldsValue({
            title: record.title,
            content: record.content,
            createDate: new Date(),
            priority: record.priority,
            category: record.categoryId,
        });
    }

    // Hàm xử lý khi sửa kiến nghị thành công
    const handleFinishEditRequest = async (values) => {
        console.log(values);
        const { title, content, createDate, priority, category } = values;

        const req = {
            title,
            content,
            createdDate: createDate,
            priority: parseInt(priority),
            categoryId: category,
        }

        console.log(req);

        await apiRequest.update(requestChoose.id, req)
            .then((res) => {
                console.log(res.data);
                if (res.data.message !== 'Cập nhật request thành công') {
                    notification.error({
                        message: 'Sửa thất bại!',
                        description: res.data.message,
                        duration: 3,
                    });
                }
                else {
                    notification.success({
                        message: 'Sửa thành công!',
                        description: 'Sửa kiến nghị thành công!',
                        duration: 3,
                    });
                    setIsOpenModalEdit(false);
                    getAllRequest();
                }
            })
            .catch((err) => {
                console.log(err);
            });

        // setLstRequest(tmplst);

        // console.log(lstRequest);


        // setIsOpenModalEdit(false);

        // notification.success({
        //     message: 'Sửa thành công!',
        //     description: 'Sửa kiến nghị thành công!',
        //     duration: 3,
        // });
    }

    // Chỉnh sửa lại phần phân trang
    const handlePagination = {
        pageSize: pageSize,
        total: lstRequest.length,
        showSizeChanger: true,
        showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} kiến nghị`,
        onShowSizeChange: (current, size) => {
            console.log(current, size);
            setPageSize(size);
        },
        locale: { items_per_page: " kiến nghị / trang" }

    }



    let emptyState = (
        <div style={style.completed.container}>
            {/* <Tada /> */}
            <h3 style={style.completed.title}>{'Không có kiến nghị nào'}</h3>
            <p style={style.completed.subtitle}>
                {
                    'Khi bạn tạo kiến nghị, chúng sẽ xuất hiện ở đây. Bạn có thể tạo kiến nghị bằng cách nhấp vào nút "Thêm kiến nghị mới" trong menu.'
                }
            </p>

        </div>
    );

    if (addVisible) {
        emptyState = null;
    }

    // if (!issues.length) {
    //     return emptyState;
    // }

    return (
        <div style={style.container}>


            <div className="table-request">
                <Table columns={columns} dataSource={lstRequest} pagination={handlePagination} scroll={{ y: 600 }} rowClassName={(record) => duplicatedKeys.includes(record.key) ? 'duplicated-row' : ''} />
            </div>

            <Modal
                title="Xem chi tiết kiến nghị"
                visible={isOpenModalView}
                footer={null}
                onCancel={() => setIsOpenModalView(false)}
                className='modal-view-request'
            >
                <div className='content-view-request'>
                    <div className='content-view-request-item'>
                        <div className='content-view-request-item-title'>Tiêu đề:</div>
                        <div className='content-view-request-item-content'>{requestChoose.title}</div>
                    </div>
                    <div className='content-view-request-item'>
                        <div className='content-view-request-item-title'>Nội dung:</div>
                        <div className='content-view-request-item-content'>{requestChoose.content}</div>
                    </div>
                    <div className='content-view-request-item'>
                        <div className='content-view-request-item-title'>Ngày tạo:</div>
                        <div className='content-view-request-item-content'>{requestChoose.createDate}</div>
                    </div>
                    <div className='content-view-request-item'>
                        <div className='content-view-request-item-title'>Độ ưu tiên:</div>
                        <div className='content-view-request-item-content'>{requestChoose.priority}</div>
                    </div>
                    <div className='content-view-request-item'>
                        <div className='content-view-request-item-title'>Lĩnh vực:</div>
                        <div className='content-view-request-item-content'>{requestChoose.category}</div>
                    </div>
                    <div className='content-view-request-item'>
                        <div className='content-view-request-item-title'>Tình trạng:</div>
                        <div className='content-view-request-item-content'>{requestChoose.statusRequest}</div>
                    </div>
                    <div className='content-view-request-item'>
                        <div className='content-view-request-item-title'>Người tạo:</div>
                        <div className='content-view-request-item-content'>{requestChoose.people?.username}</div>
                    </div>
                    {
                        (requestChoose && requestChoose.process?.length > 1) &&
                        <div className='content-view-request-item'>
                            <div className='content-view-request-item-title'>Người chuyển tiếp:</div>
                            <div className='content-view-request-item-content'>{requestChoose.process[requestChoose.process.length - 1].people?.username}</div>
                        </div>
                    }
                </div>
            </Modal>

            <Modal
                title="Sửa kiến nghị"
                visible={isOpenModalEdit}
                onOk={formEdit.submit}
                onCancel={() => setIsOpenModalEdit(false)}
                okText='Lưu'
                cancelText='Hủy'
            >
                <Form
                    name="editForm"
                    layout='vertical'
                    className='form-edit'
                    form={formEdit}
                    onFinish={handleFinishEditRequest}
                >
                    <Form.Item
                        label="Tiêu đề"
                        name="title"
                        className='form-item'
                        rules={[
                            {
                                required: true,
                                message: "Vui lòng nhập tiêu đề!"
                            }
                        ]}
                    >
                        <Input placeholder='Nhập tiêu đề' />
                    </Form.Item>

                    <Form.Item
                        label="Nội dung"
                        name="content"
                        className='form-item'
                        rules={[
                            {
                                required: true,
                                message: "Vui lòng nhập nội dung!"
                            }
                        ]}
                    >
                        <Input.TextArea placeholder='Nhập nội dung'
                            autoSize={{ minRows: 5, maxRows: 500 }}
                        />
                    </Form.Item>

                    {/* <Form.Item
                        label="Ngày tạo"
                        name="createDate"
                        className='form-item'
                        rules={[
                            {
                                required: true,
                                message: "Vui lòng chọn ngày tạo!"
                            }
                        ]}

                    >
                        <DatePicker style={{ width: '100%' }} format='DD/MM/YYYY' placeholder='Chọn ngày tạo' disabledDate={(current) => current && current.isAfter(dayjs())} />
                    </Form.Item> */}

                    <Form.Item
                        label="Độ ưu tiên"
                        name="priority"
                        className='form-item'
                        rules={[
                            {
                                required: true,
                                message: "Vui lòng chọn độ ưu tiên!"
                            }
                        ]}
                    >
                        <Select placeholder='Chọn độ ưu tiên' value={
                            requestChoose.priority
                        }>
                            <Select.Option value="1">1</Select.Option>
                            <Select.Option value="2">2</Select.Option>
                            <Select.Option value="3">3</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        label="Lĩnh vực"
                        name="category"
                        className='form-item'
                        rules={[
                            {
                                required: true,
                                message: "Vui lòng chọn lĩnh vực!"
                            }
                        ]}
                    >
                        <Select placeholder='Chọn lĩnh vực' value={requestChoose.category}>
                            {lstCategory.map((item, index) => {
                                return (
                                    <Select.Option key={index} value={item._id}>{item.description}</Select.Option>
                                )
                            })}
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Modal gán trùng, trong đó sẽ hiển thị danh sách các kiến nghị trùng nhau */}
            <Modal
                title="Danh sách kiến nghị trùng"
                visible={isShowModalDuplicate}
                footer={null}
                onCancel={() => setIsShowModalDuplicate(false)}
                width={'100%'}
            >
                <div className='content-duplicate-request'>
                    <div className='content-duplicate-request-list'>
                        <Table columns={columnsDuplicate} dataSource={lstDuplicateRequest} pagination={false} />
                    </div>
                </div>
            </Modal>

            <Modal
                title="Chuyển tiếp kiến nghị"
                visible={isOpenModalForward}
                onOk={handleOkModalForward}
                onCancel={handleCloseModalForward}
                okText='Chuyển tiếp'
                cancelText='Hủy'

            >
                <Form
                    name="forwardForm"
                    layout='vertical'
                    className='form-forward'
                    form={formForward}
                >
                    <Form.Item
                        label="Người nhận"
                        name="persionForwardTo"
                        className='form-item'
                        rules={[
                            {
                                required: true,
                                message: "Vui lòng chọn người nhận!"
                            }
                        ]}
                    >
                        <Select
                            placeholder='Chọn người nhận'
                            style={{ width: '100%' }}
                        >
                            {lstUser.map((item, index) => {

                                if (item._id === userId) {
                                    return null;
                                }

                                return (
                                    <Select.Option key={index} value={item._id}>{item.username}</Select.Option>
                                )
                            })}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        label="Hành động"
                        name="actionForward"
                        className='form-item'
                        rules={[
                            {
                                required: true,
                                message: "Vui lòng chọn người nhận!"
                            }
                        ]}
                    >
                        <Select
                            showSearch
                            optionFilterProp='children'
                            placeholder='Chọn hành động'
                            style={{ width: '100%' }}
                        >
                            {lstAction.map((item, index) => {
                                return (
                                    <Select.Option key={index} value={item._id}>{item.actionName}</Select.Option>
                                )
                            })}
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>

        </div>
    )
}

ToDoEditor.propTypes = {
    addVisible: PropTypes.bool.isRequired,
    remove: PropTypes.func.isRequired,
    issues: PropTypes.arrayOf(PropTypes.object),
    theme: PropTypes.object.isRequired,
    siteURL: PropTypes.string.isRequired,
    complete: PropTypes.func.isRequired,
    accept: PropTypes.func.isRequired,
    bump: PropTypes.func.isRequired,
    list: PropTypes.string.isRequired,
    numberCallApi: PropTypes.number.isRequired,
};

const getStyle = makeStyleFromTheme((theme) => {
    return {
        container: {
            padding: '8px 20px',
            display: 'flex',
            alignItems: 'flex-start',
        },
        completed: {
            container: {
                textAlign: 'center',
                padding: '116px 40px',
            },
            title: {
                fontSize: 20,
                fontWeight: 600,
            },
            subtitle: {
                fontSize: 14,
                color: changeOpacity(theme.centerChannelColor, 0.72),
            },
        },
        itemContent: {
            padding: '0 0 0 16px',
        },
        issueTitle: {
            color: theme.centerChannelColor,
            lineHeight: 1.7,
            fontWeight: 'bold',
        },
        subtitle: {
            fontSize: '13px',
        },
        message: {
            width: '100%',
            overflowWrap: 'break-word',
            whiteSpace: 'pre-wrap',
        },
    };
});

export default ToDoEditor;
