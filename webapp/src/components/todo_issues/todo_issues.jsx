// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import moment from 'moment';

import {
    makeStyleFromTheme,
    changeOpacity,
} from 'mattermost-redux/utils/theme_utils';
import { Button, Col, DatePicker, Form, Input, Modal, notification, Popover, Row, Select, Table } from 'antd';
import { BsThreeDots } from "react-icons/bs";

import './todo_issues.scss';
import TodoItem from '../todo_item';
import Tada from '../../illustrations/tada';
import { apiCategory } from '../../api/category';
import { apiAuth } from '../../api/auth';
import { apiRequest } from '../../api/request';

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
        dataIndex: 'action',
        key: 'action',
        render: (text, record) => (
            <span
                style={{
                    cursor: 'pointer',
                }}>
                <Popover
                    content={
                        <div className='content-action'>
                            <div
                                className='content-action-item'
                            >
                                Xem chi tiết
                            </div>
                            <div
                                className={'content-action-item'}
                            >
                                Xóa
                            </div>
                            <div
                                className={'content-action-item'}
                            >
                                Sửa
                            </div>
                            <div
                                className={'content-action-item'}
                            >
                                Chuyển tiếp
                            </div>
                        </div>
                    }
                    trigger="hover">
                    <BsThreeDots />
                </Popover>

            </span>
        ),
    },
];
axios.defaults.withCredentials = true;

function ToDoIssues(props) {
    const style = getStyle(props.theme);
    const { theme, siteURL, accept, complete, list, remove, bump, addVisible, issues, numberCallApi } = props;

    const [isLogin, setIsLogin] = React.useState(false);
    const [lstRequest, setLstRequest] = useState([]); // Danh sách kiến nghị

    useEffect(() => {
        isLogin &&
            getAllRequest();
        !isLogin && loginUser();

    }, [isLogin]);

    useEffect(() => {
        isLogin && getAllRequest();
    }, [numberCallApi]);

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
                });
                console.log(data);

                setLstRequest(data);
            })
            .catch((err) => {
                console.log(err);
            });
    }

    // const getAllCategory = async () => {
    //     await apiCategory.getAll()
    //         .then((res) => {
    //             console.log(res.data.data);
    //             if (res.data.data) {
    //                 setLstCategory(res.data.data);
    //             }

    //         })
    //         .catch((err) => {
    //             console.log(err);
    //         });
    // }

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
                }
                else {
                    setIsLogin(false);
                }
            })
            .catch((err) => {
                console.log(err);
            });
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
            <Table bordered columns={columns} dataSource={lstRequest} scroll={{ y: 600}} />

        </div>
    )
}

ToDoIssues.propTypes = {
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

export default ToDoIssues;
