import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

const Button = ({ title, onPress, disabled = false, ...props }) => {
    return (
        <TouchableOpacity
            style={[styles.button, disabled && styles.disabled]}
            onPress={onPress}
            disabled={disabled}
            {...props}
        >
            <Text style={[styles.text, disabled && styles.disabledText]}>
                {title}
            </Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        backgroundColor: theme.colors.primary,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        shadowColor: theme.colors.primary,
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    text: {
        color: theme.colors.background,
        fontSize: theme.fontSizes.lg,
        fontWeight: '600',
    },
    disabled: {
        backgroundColor: theme.colors.secondary,
    },
    disabledText: {
        color: theme.colors.textSecondary,
    },
});

export default Button;
