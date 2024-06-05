import React from 'react';
import { Dropdown } from 'react-bootstrap';

const DropDown: React.FC = () => {
    return (
        <Dropdown>
            <Dropdown.Toggle as="div" id="dropdown-basic">
                ...
            </Dropdown.Toggle>

            <Dropdown.Menu>
                <Dropdown.Item href="#action1">Action 1</Dropdown.Item>
                <Dropdown.Item href="#action2">Action 2</Dropdown.Item>
                <Dropdown.Item href="#action3">Action 3</Dropdown.Item>
            </Dropdown.Menu>
        </Dropdown>
    );
};

export default DropDown;