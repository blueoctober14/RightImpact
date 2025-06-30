import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';

// Constants for contact assignment
const CONTACTS_PER_USER = 50;
const INACTIVE_THRESHOLD = 15; // minutes

export const getAssignedContacts = async () => {
    try {
        const response = await api.get('/contacts/assigned');
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const assignContacts = async () => {
    try {
        const response = await api.post('/contacts/assign');
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const releaseContacts = async () => {
    try {
        const response = await api.post('/contacts/release');
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const updateLastActive = async () => {
    try {
        const response = await api.post('/user/last-active');
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const checkContactsAvailable = async () => {
    try {
        const response = await api.get('/contacts/available');
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getContactAssignmentStats = async () => {
    try {
        const response = await api.get('/contacts/stats');
        return response.data;
    } catch (error) {
        throw error;
    }
};
