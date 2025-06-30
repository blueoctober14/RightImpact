import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';

export const getMessages = async () => {
    try {
        const response = await api.get('/messages');
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getAvailableContacts = async () => {
    try {
        const response = await api.get('/contacts/available');
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const sendMessage = async (contactId, message) => {
    try {
        const response = await api.post('/messages/send', {
            contact_id: contactId,
            message,
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getAssignedContactsCount = async () => {
    try {
        const response = await api.get('/contacts/assigned-count');
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getRemainingContactsCount = async () => {
    try {
        const response = await api.get('/contacts/remaining-count');
        return response.data;
    } catch (error) {
        throw error;
    }
};
