import axios from 'axios';
import { API_URL } from '../common/enum'

const URL = API_URL.HOST + '/categories';

export const apiCategory = {
    getAll() {
        return axios.get(`${URL}`,
            {
                withCredentials: true,
            });
    }
};
