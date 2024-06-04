import axios from 'axios';
import { API_URL } from '../common/enum'

const URL = API_URL.HOST + '/actions';

export const apiAction = {
    getAll() {
        return axios.get(`${URL}`,
            {
                withCredentials: true,
            });
    }
};
