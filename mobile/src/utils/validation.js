export const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
};

export const validatePassword = (password) => {
    // Password must be at least 8 characters, contain at least one number and one letter
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    return passwordRegex.test(password);
};

export const validateName = (name) => {
    // Name must be at least 2 characters and only contain letters and spaces
    const nameRegex = /^[a-zA-Z\s]{2,}$/;
    return nameRegex.test(name);
};

export const validateCity = (city) => {
    // City must be at least 2 characters and only contain letters and spaces
    return validateName(city);
};

export const validateState = (state) => {
    // State must be exactly 2 letters
    const stateRegex = /^[A-Z]{2}$/;
    return stateRegex.test(state);
};

export const validateZipCode = (zipCode) => {
    // Zip code must be 5 digits
    const zipRegex = /^[0-9]{5}$/;
    return zipRegex.test(zipCode);
};

export const validateRegistration = (formData) => {
    const errors = {};

    if (!validateEmail(formData.email)) {
        errors.email = 'Please enter a valid email address';
    }

    if (!validatePassword(formData.password)) {
        errors.password = 'Password must be at least 8 characters and contain at least one number and one letter';
    }

    if (!validateName(formData.firstName)) {
        errors.firstName = 'First name must be at least 2 characters and contain only letters';
    }

    if (!validateName(formData.lastName)) {
        errors.lastName = 'Last name must be at least 2 characters and contain only letters';
    }

    if (!validateCity(formData.city)) {
        errors.city = 'City must be at least 2 characters and contain only letters';
    }

    if (!validateState(formData.state)) {
        errors.state = 'State must be exactly 2 letters (e.g., NY, CA)';
    }

    if (!validateZipCode(formData.zipCode)) {
        errors.zipCode = 'Zip code must be 5 digits';
    }

    return errors;
};
