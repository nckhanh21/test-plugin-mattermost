import {connect} from 'react-redux';

import {isAddCardVisible} from 'selectors';

import ToDoEditor from './todo_editor'; 

const mapStateToProps = (state) => ({
    addVisible: isAddCardVisible(state),
});

export default connect(mapStateToProps, null)(ToDoEditor);
