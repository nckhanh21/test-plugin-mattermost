import {connect} from 'react-redux';

import {isAddCardVisible} from 'selectors';

import ToDoSynthetic from './todo_synthetic'; 

const mapStateToProps = (state) => ({
    addVisible: isAddCardVisible(state),
});

export default connect(mapStateToProps, null)(ToDoSynthetic);
