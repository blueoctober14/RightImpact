import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { theme } from '../theme';

const Input = ({
    label,
    value,
    onChangeText,
    placeholder,
    secureTextEntry = false,
    error,
    ...props
}) => {
    return (
        <View style={styles.container}>
            <TextInput
                style={[styles.input, error && styles.errorInput]}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                secureTextEntry={secureTextEntry}
                {...props}
            />
            {error && (
                <View style={styles.errorContainer}>
                    <TextInput
                        style={styles.errorText}
                        editable={false}
                        value={error}
                    />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: theme.spacing.md,
    },
    input: {
        backgroundColor: theme.colors.background,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.sm,
        borderWidth: 1,
        borderColor: theme.colors.border,
        fontSize: theme.fontSizes.md,
        color: theme.colors.text,
    },
    errorInput: {
        borderColor: theme.colors.error,
    },
    errorContainer: {
        marginTop: theme.spacing.sm,
    },
    errorText: {
        color: theme.colors.error,
        fontSize: theme.fontSizes.sm,
    },
});

export default Input;
