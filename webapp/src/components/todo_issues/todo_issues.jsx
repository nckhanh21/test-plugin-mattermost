// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, { useEffect } from 'react';
import PropTypes from 'prop-types';

import {
    makeStyleFromTheme,
    changeOpacity,
} from 'mattermost-redux/utils/theme_utils';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';


import TodoItem from '../todo_item';
import Tada from '../../illustrations/tada';
import axios from 'axios';

function ToDoIssues(props) {
    const style = getStyle(props.theme);
    const { theme, siteURL, accept, complete, list, remove, bump, addVisible, issues } = props;

    useEffect(() => {
        // const data = await axios.get
    } , []);

    const data = [
        {
            STT: 1,
            title: 'test edit phat ne',
            content: 'test nội dung 3',
            date: '03/05/2024',
            field: 'Tao thu mot danh muc xem the nao',
            status: 'Bien tap',
            actions: {
                view: 'http://localhost:3000/view?id=1',
                edit: 'http://localhost:3000/edit?id=1',
                delete: 'http://localhost:3000/delete?id=1'
            }
        },
        {
            STT: 2,
            title: 'test',
            content: 'test nội dung',
            date: '01/05/2024',
            field: 'nhieu linh vuc',
            status: 'Da tao',
            actions: {
                view: 'http://localhost:3000/view?id=2',
                edit: 'http://localhost:3000/edit?id=2',
                delete: 'http://localhost:3000/delete?id=2'
            }
        },
        {
            STT: 3,
            title: 'test',
            content: 'test nội dung 2',
            date: '02/05/2024',
            field: 'Tao thu mot danh muc xem the nao',
            status: 'Da tao',
            actions: {
                view: 'http://localhost:3000/view?id=3',
                edit: 'http://localhost:3000/edit?id=3',
                delete: 'http://localhost:3000/delete?id=3'
            }
        },
        {
            STT: 4,
            title: 'test',
            content: 'test nội dung 2',
            date: '02/05/2024',
            field: 'Tao thu mot danh muc xem the nao',
            status: 'Da tao',
            actions: {
                view: 'http://localhost:3000/view?id=3',
                edit: 'http://localhost:3000/edit?id=3',
                delete: 'http://localhost:3000/delete?id=3'
            }
        },
        {
            STT: 5,
            title: 'test',
            content: 'test nội dung 2',
            date: '02/05/2024',
            field: 'Tao thu mot danh muc xem the nao',
            status: 'Da tao',
            actions: {
                view: 'http://localhost:3000/view?id=3',
                edit: 'http://localhost:3000/edit?id=3',
                delete: 'http://localhost:3000/delete?id=3'
            }
        },
        {
            STT: 6,
            title: 'test',
            content: 'test nội dung 2',
            date: '02/05/2024',
            field: 'Tao thu mot danh muc xem the nao',
            status: 'Da tao',
            actions: {
                view: 'http://localhost:3000/view?id=3',
                edit: 'http://localhost:3000/edit?id=3',
                delete: 'http://localhost:3000/delete?id=3'
            }
        },
        {
            STT: 7,
            title: 'test',
            content: 'test nội dung 2',
            date: '02/05/2024',
            field: 'Tao thu mot danh muc xem the nao',
            status: 'Da tao',
            actions: {
                view: 'http://localhost:3000/view?id=3',
                edit: 'http://localhost:3000/edit?id=3',
                delete: 'http://localhost:3000/delete?id=3'
            }
        }
       
    ];

    let emptyState = (
        <div style={style.completed.container}>
            {/* <Tada/> */}
            <h3 style={style.completed.title}>{'Plugin của Khánh. '}</h3>
            <p style={style.completed.subtitle}>
                {/* Vẽ 1 bảng hiển thị danh sách task ngày hôm này (fake dữ liệu) */}
                <Table striped bordered hover>
                    <thead>
                        <tr>
                            <th>STT</th>
                            <th>Title</th>
                            <th>Content</th>
                            <th>Date</th>
                            <th>Field</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((item, index) => {
                            return (
                                <tr key={index}>
                                    <td>{item.STT}</td>
                                    <td>{item.title}</td>
                                    <td>{item.content}</td>
                                    <td>{item.date}</td>
                                    <td>{item.field}</td>
                                    <td>{item.status}</td>
                                    <td>
                                        <Button variant="success" href={item.actions.edit}>Edit</Button>
                                        <Button variant="danger" href={item.actions.delete}>Delete</Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </Table>
            </p>

        </div>
    );

    if (addVisible) {
        emptyState = null;
    }

    if (!issues.length) {
        return emptyState;
    }

    return issues.map((issue) => (
        <TodoItem
            issue={issue}
            theme={theme}
            siteURL={siteURL}
            accept={accept}
            complete={complete}
            list={list}
            remove={remove}
            bump={bump}
            key={issue.id}
        />
    ));
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
