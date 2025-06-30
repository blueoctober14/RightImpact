import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import Input from '../components/Input';
import Button from '../components/Button';
import { register } from '../services/auth';
import { validateRegistration } from '../utils/validation';

const RegisterScreen = ({ navigation }) => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        city: '',
        state: '',
        zipCode: '',
    });

    const [errors, setErrors] = useState({});

    const handleChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value,
        }));

        // Clear error for the field when it's changed
        setErrors(prev => ({
            ...prev,
            [field]: '',
        }));
    };

    const validate = () => {
        const validationErrors = validateRegistration(formData);
        setErrors(validationErrors);
        return Object.keys(validationErrors).length === 0;
    };

    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        if (!validate()) return;

        try {
            setLoading(true);
            const response = await register(formData);
            // Navigate to login screen on successful registration
            navigation.navigate('Login');
        } catch (err) {
            setErrors({
                ...errors,
                general: err.message || 'Registration failed. Please try again.',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={styles.content}>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>Join our campaign</Text>

                <Input
                    placeholder="Email"
                    value={formData.email}
                    onChangeText={(value) => handleChange('email', value)}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    error={errors.email}
                />

                <Input
                    placeholder="Password"
                    value={formData.password}
                    onChangeText={(value) => handleChange('password', value)}
                    secureTextEntry
                    error={errors.password}
                />

                <Input
                    placeholder="First Name"
                    value={formData.firstName}
                    onChangeText={(value) => handleChange('firstName', value)}
                    error={errors.firstName}
                />

                <Input
                    placeholder="Last Name"
                    value={formData.lastName}
                    onChangeText={(value) => handleChange('lastName', value)}
                    error={errors.lastName}
                />

                <Input
                    placeholder="City"
                    value={formData.city}
                    onChangeText={(value) => handleChange('city', value)}
                    error={errors.city}
                />

                <Input
                    placeholder="State"
                    value={formData.state}
                    onChangeText={(value) => handleChange('state', value)}
                    error={errors.state}
                    autoCapitalize="characters"
                />

                <Input
                    placeholder="Zip Code"
                    value={formData.zipCode}
                    onChangeText={(value) => handleChange('zipCode', value)}
                    error={errors.zipCode}
                    keyboardType="numeric"
                />

                <Button
                    title={loading ? 'Registering...' : 'Sign Up'}
                    onPress={handleRegister}
                    disabled={loading || Object.values(formData).some(value => !value)}
                />
                {errors.general && (
                    <Text style={styles.errorText}>
                        {errors.general}
                    </Text>
                )}

                {errors.general && (
                    <Text style={styles.errorText}>
                        {errors.general}
                    </Text>
                )}

                <Button
                    title="Back to Login"
                    onPress={() => navigation.navigate('Login')}
                    style={styles.backButton}
                />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    content: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
    },
    title: {
        fontSize: theme.fontSizes.xl,
        fontWeight: '700',
        color: theme.colors.text,
        marginBottom: theme.spacing.sm,
    },
    subtitle: {
        fontSize: theme.fontSizes.md,
        color: theme.colors.textSecondary,
        marginBottom: theme.spacing.lg,
    },
    errorText: {
        color: theme.colors.error,
        fontSize: theme.fontSizes.sm,
        marginTop: theme.spacing.sm,
        textAlign: 'center',
    },
    backButton: {
        marginTop: theme.spacing.lg,
        backgroundColor: theme.colors.secondary,
    },
});

export default RegisterScreen;
